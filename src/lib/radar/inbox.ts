import { db } from "@/lib/db";
import { draftReply, radarApiKey } from "./ai";
import { parseRadarTap } from "./actions-parse";
import { resolveRadarDelivery } from "./delivery";
import { hideReasonKeyboard, radarKeyboard, type RadarAlert } from "./notify";
import { ensureRadarProfile } from "./profile";
import { HIDE_REASONS, type HideReason } from "./responses";

type CallbackQuery = {
  id: string;
  data?: string;
  message?: { message_id: number; chat: { id: number } };
};

let offset = 0;
let polling = false;

export function startRadarInbox() {
  if (polling) return;
  polling = true;
  void loop();
}

async function loop() {
  let delivery: { token: string; chat: string } | null = null;
  try {
    delivery = await resolveRadarDelivery(null);
    if (!delivery) {
      setTimeout(loop, 60_000);
      return;
    }
    const hook = await tg(delivery.token, "getWebhookInfo", {});
    const url = (hook.result as { url?: string } | undefined)?.url;
    if (url) {
      console.log("[hh-radar] у бота уже есть webhook, кнопки в чате не слушаю");
      return;
    }
  } catch (e) {
    console.error("[hh-radar] inbox", e instanceof Error ? e.message : e);
    setTimeout(loop, 60_000);
    return;
  }
  if (!delivery) return;
  for (;;) {
    try {
      const data = await tg(delivery.token, "getUpdates", {
        offset,
        timeout: 0,
        allowed_updates: ["callback_query"],
      });
      const updates = (data.result as Array<{ update_id: number; callback_query?: CallbackQuery }> | undefined) || [];
      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.callback_query) await onCallback(delivery, update.callback_query);
      }
    } catch (e) {
      console.error("[hh-radar] inbox", e instanceof Error ? e.message : e);
    }
    await sleep(2000);
  }
}

async function onCallback(delivery: { token: string; chat: string }, query: CallbackQuery) {
  const tap = parseRadarTap(query.data || "");
  const chatId = query.message ? String(query.message.chat.id) : "";
  if (!tap || chatId !== delivery.chat) {
    await answer(delivery.token, query.id, "Не понял кнопку");
    return;
  }
  const vacancy = await db.jobVacancy.findUnique({ where: { id: tap.id } });
  if (!vacancy || !query.message) {
    await answer(delivery.token, query.id, "Вакансия уже не в радаре");
    return;
  }

  if (tap.type === "hide-menu") {
    await answer(delivery.token, query.id, "Почему скрыть?");
    await editKeyboard(delivery.token, chatId, query.message.message_id, hideReasonKeyboard(vacancy.id));
    return;
  }
  if (tap.type === "hide-back") {
    await answer(delivery.token, query.id, "");
    await editKeyboard(delivery.token, chatId, query.message.message_id, radarKeyboard(toAlert(vacancy)));
    return;
  }
  if (tap.type === "hide") {
    await db.jobVacancy.update({
      where: { id: vacancy.id },
      data: { status: "hidden", hideReason: tap.reason },
    });
    await answer(delivery.token, query.id, `Скрыто: ${HIDE_REASONS[tap.reason as HideReason]}`);
    return;
  }
  if (tap.type === "applied") {
    await db.jobVacancy.update({ where: { id: vacancy.id }, data: { status: "applied", hideReason: null } });
    await answer(delivery.token, query.id, "Отметил: откликнулись");
    return;
  }

  await answer(delivery.token, query.id, "Готовлю черновик");
  let text = vacancy.replyDraft?.trim() || "";
  if (!text) {
    const apiKey = radarApiKey();
    if (!apiKey) {
      await send(delivery.token, chatId, "Черновик не собрался: нет ключа OpenRouter.");
      return;
    }
    const profile = await ensureRadarProfile();
    try {
      text = await draftReply({
        apiKey,
        specialization: profile.specialization,
        about: profile.about,
        directions: profile.directions,
        skills: profile.skills,
        title: vacancy.title,
        company: vacancy.company,
        description: vacancy.description,
      });
      if (text) await db.jobVacancy.update({ where: { id: vacancy.id }, data: { replyDraft: text } });
    } catch (e) {
      console.error("[hh-radar] reply", e instanceof Error ? e.message : e);
    }
  }
  if (!text) {
    await send(delivery.token, chatId, "Черновик не собрался. Откройте вакансию в радаре и попробуйте ещё раз.");
    return;
  }
  await send(
    delivery.token,
    chatId,
    `Черновик отклика\n${vacancy.title}\n\n${text}\n\nПисьмо не отправлено. Скопируйте его и вставьте на HH.`,
  );
}

function toAlert(row: {
  id: string;
  title: string;
  company: string | null;
  url: string;
  salaryFrom: number | null;
  salaryTo: number | null;
  salaryCurrency: string | null;
  salaryGross: boolean | null;
  remote: boolean;
  employment: string | null;
  publishedAt: Date | null;
  firstSeenAt: Date;
  matchScore: number | null;
  trustScore: number | null;
  fitReasons: string[];
  responsesCount: number | null;
}): RadarAlert {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    url: row.url,
    salaryFrom: row.salaryFrom,
    salaryTo: row.salaryTo,
    salaryCurrency: row.salaryCurrency,
    salaryGross: row.salaryGross,
    remote: row.remote,
    employment: row.employment,
    publishedAt: row.publishedAt,
    firstSeenAt: row.firstSeenAt,
    matchScore: row.matchScore || 0,
    trustScore: row.trustScore || 0,
    fitReasons: row.fitReasons,
    responsesCount: row.responsesCount,
  };
}

async function answer(token: string, id: string, text: string) {
  await tg(token, "answerCallbackQuery", { callback_query_id: id, text: text.slice(0, 180) });
}

async function editKeyboard(token: string, chatId: string, messageId: number, markup: unknown) {
  await tg(token, "editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: markup,
  });
}

async function send(token: string, chatId: string, text: string) {
  await tg(token, "sendMessage", { chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true });
}

async function tg(token: string, method: string, body: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  return (await response.json()) as { ok?: boolean; result?: unknown };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
