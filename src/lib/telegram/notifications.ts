// Telegram-уведомления v5 — услуги: бюджет / город / отклики, одна кнопка

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
  /** @deprecated v5 не показывает простыню */
  reasoning?: string;
  responseText?: string;
}

const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

export function formatLeadTelegram(lead: LeadNotification): string {
  const hot =
    (lead.responses != null && lead.responses <= 1) ||
    /только что|^[1-5] мин/i.test(lead.ageLabel || "");
  const emoji = hot ? "🔥" : lead.responsePrice ? "⚡" : "📌";
  const title = escapeHtml((lead.title || "Новый заказ").trim().slice(0, 120));

  const chips: string[] = [];
  if (lead.budget && lead.budget !== "не указан") chips.push(`💰 ${escapeHtml(lead.budget)}`);
  else chips.push("💰 бюджет не указан");
  if (lead.city) chips.push(`📍 ${escapeHtml(lead.city)}${lead.remote ? " · дистант" : ""}`);
  else if (lead.remote) chips.push("📍 дистанционно");
  if (lead.responses != null) chips.push(`👥 ${lead.responses} откл.`);
  if (lead.responsePrice && lead.responsePrice > 0) chips.push(`💳 отклик ${lead.responsePrice} ₽`);

  const meta: string[] = [];
  if (lead.ageLabel) meta.push(`⏱ ${escapeHtml(lead.ageLabel)}`);
  if (lead.matchedKeyword) meta.push(`совпало: ${escapeHtml(lead.matchedKeyword)}`);
  if (lead.clientHint) meta.push(escapeHtml(lead.clientHint));
  if (lead.responses != null && lead.responses <= 1) meta.push("мало конкурентов");

  const lines = [`${emoji} <b>${title}</b>`, chips.join("    ")];
  if (meta.length) lines.push(meta.join(" · "));
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
  const buttons: Array<Array<{ text: string; url?: string }>> = [[{ text: "Открыть на Profi", url: lead.url }]];
  if (lead.platform && !/profi/i.test(lead.platform)) {
    buttons[0][0].text = "Открыть заказ";
  }

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

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
