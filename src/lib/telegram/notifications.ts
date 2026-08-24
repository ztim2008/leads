// Telegram-уведомления v5.2 — карточка + блок «Текст отклика» + copy_text

export interface LeadNotification {
  platform: string;
  platformColor?: string;
  score?: number;
  title: string;
  budget: string;
  url: string;
  city?: string;
  remote?: boolean;
  responses?: number;
  responsePrice?: number;
  ageLabel?: string;
  matchedKeyword?: string;
  clientHint?: string;
  /** Суть задачи из ленты (без простыни deep scan). */
  taskSnippet?: string;
  author?: string;
  reviewCount?: number;
  newbie?: boolean;
  riskHint?: string;
  /** Заполненные шаблоны партнёра (без AI). */
  replyTexts?: Array<{ name: string; text: string }>;
  /** @deprecated */
  reasoning?: string;
  responseText?: string;
}

const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_COPY_MAX = 256;

export function formatLeadTelegram(lead: LeadNotification): string {
  const hot =
    (lead.responses != null && lead.responses <= 1) ||
    /только что|^[1-5] мин/i.test(lead.ageLabel || "");
  const emoji = hot ? "🔥" : lead.responsePrice ? "⚡" : "📌";
  const title = escapeHtml((lead.title || "Новый заказ").trim().slice(0, 120));

  const lines = [`${emoji} <b>${title}</b>`];
  if (lead.budget && lead.budget !== "не указан") lines.push(`💰 ${escapeHtml(lead.budget)}`);
  else lines.push("💰 бюджет не указан");
  if (lead.city) lines.push(`📍 ${escapeHtml(lead.city)}${lead.remote ? " · дистант" : ""}`);
  else if (lead.remote) lines.push("📍 дистанционно");
  if (lead.responses != null) lines.push(`👥 ${lead.responses} откл.${lead.responses <= 1 ? " · мало конкурентов" : ""}`);
  if (lead.responsePrice && lead.responsePrice > 0) {
    lines.push(`💳 Цена отклика: ${lead.responsePrice} ₽`);
  } else if (/profi/i.test(lead.platform)) {
    lines.push("💳 Цена отклика: не показана в ленте");
  }
  if (lead.ageLabel) lines.push(`⏱ ${escapeHtml(lead.ageLabel)}`);
  if (lead.matchedKeyword) lines.push(`🎯 Совпало: ${escapeHtml(lead.matchedKeyword)}`);
  if (lead.clientHint) lines.push(`ℹ️ ${escapeHtml(lead.clientHint)}`);

  if (lead.taskSnippet?.trim()) {
    lines.push("");
    lines.push("📝 <b>Задача</b>");
    lines.push(formatTask(lead.taskSnippet));
  }

  const clientBits: string[] = [];
  if (lead.author) clientBits.push(`👤 ${escapeHtml(lead.author)}`);
  if (lead.reviewCount != null && lead.reviewCount > 0) {
    clientBits.push(`⭐ ${lead.reviewCount} отз.`);
  } else if (lead.newbie) {
    clientBits.push("🆕 новичок / без отзывов");
  }
  if (clientBits.length) lines.push(clientBits.join(" · "));

  if (lead.riskHint) lines.push(`⚠ ${escapeHtml(lead.riskHint)}`);

  const replies = resolveReplyTexts(lead);
  if (replies.length) {
    lines.push("");
    lines.push("✍️ <b>Текст отклика</b>");
    lines.push("<i>Скопируйте и вставьте на Profi сами. Авто-отправки нет.</i>");
    for (const r of replies) {
      lines.push("");
      lines.push(`<b>${escapeHtml(r.name)}</b>`);
      lines.push(`<pre>${escapeHtml(r.text.slice(0, 3500))}</pre>`);
    }
  }

  return lines.join("\n");
}

export async function sendLeadNotification(
  chatId: string,
  lead: LeadNotification,
  botToken?: string,
): Promise<boolean> {
  const token = botToken || DEFAULT_BOT_TOKEN;
  if (!token || !chatId || !lead.url) return false;

  const text = formatLeadTelegram(lead);
  const buttons = buildKeyboard(lead);

  try {
    const body = {
      chat_id: chatId,
      text,
      parse_mode: "HTML" as const,
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: buttons },
    };
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await response.json()) as { ok: boolean; description?: string };
    if (!data.ok && data.description?.includes("parse")) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text.replace(/<[^>]+>/g, ""),
          disable_web_page_preview: true,
          reply_markup: { inline_keyboard: buttons },
        }),
        signal: AbortSignal.timeout(8000),
      });
      return ((await res.json()) as { ok: boolean }).ok === true;
    }
    return data.ok === true;
  } catch (error) {
    console.error("[telegram] Ошибка:", error);
    return false;
  }
}

type TgButton = {
  text: string;
  url?: string;
  copy_text?: { text: string };
};

function buildKeyboard(lead: LeadNotification): TgButton[][] {
  const openLabel = lead.platform && !/profi/i.test(lead.platform) ? "Открыть заказ" : "Открыть на Profi";
  const rows: TgButton[][] = [[{ text: openLabel, url: lead.url }]];

  const copyRow: TgButton[] = [];
  for (const r of resolveReplyTexts(lead)) {
    if (r.text.length === 0 || r.text.length > TG_COPY_MAX) continue;
    const label = `📋 ${r.name}`.slice(0, 64);
    copyRow.push({ text: label, copy_text: { text: r.text } });
    if (copyRow.length >= 3) break;
  }
  if (copyRow.length) rows.push(copyRow);
  return rows;
}

function resolveReplyTexts(lead: LeadNotification): Array<{ name: string; text: string }> {
  if (lead.replyTexts?.length) {
    return lead.replyTexts.filter((r) => r.text?.trim()).slice(0, 3);
  }
  if (lead.responseText?.trim()) {
    return [{ name: "Отклик", text: lead.responseText.trim() }];
  }
  return [];
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatTask(text: string): string {
  return text
    .trim()
    .split(/\s*(?:·|\n)\s*/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(escapeHtml)
    .join("\n");
}
