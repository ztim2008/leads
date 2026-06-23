// Telegram-уведомления о новых заявках — v2: карточки с AI-скорингом

export interface LeadNotification {
  platform: string;
  platformColor: string;
  score: number;
  title: string;
  budget: string;
  url: string;
  reasoning: string;
  // Данные глубокого сканирования
  author?: string;
  reviewCount?: number;
  yearsOnPlatform?: number;
  clientRating?: number;
  city?: string;
  botProbability?: number;
  descriptionLength?: number;
  response?: string;
}

const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

export async function sendLeadNotification(
  chatId: string,
  lead: LeadNotification,
  botToken?: string
): Promise<boolean> {
  const token = botToken || DEFAULT_BOT_TOKEN;
  if (!token || !chatId) return false;

  const score = lead.score || 0;

  // ─── Заголовок в зависимости от скора ───
  let header: string;
  if (score >= 85) header = `🔥 <b>ГОРЯЧИЙ ЛИД</b> · ${lead.platform}`;
  else if (score >= 70) header = `⭐ <b>Хороший лид</b> · ${lead.platform}`;
  else if (score >= 40) header = `💡 <b>Заявка</b> · ${lead.platform}`;
  else header = `📌 <b>Заявка</b> · ${lead.platform}`;

  // ─── Строка скора ───
  const scoreLine = score > 0 ? `<b>${score}/100</b>` : "";

  // ─── Rich-метаданные ───
  const meta: string[] = [];
  if (lead.reviewCount && lead.reviewCount > 0) meta.push(`⭐ ${lead.reviewCount} отз.`);
  if (lead.yearsOnPlatform && lead.yearsOnPlatform > 0) meta.push(`👤 ${lead.yearsOnPlatform} г. на Profi`);
  if (lead.author) meta.push(`👤 ${lead.author}`);
  if (lead.city) meta.push(`📍 ${lead.city}`);

  // ─── Рейтинг клиента звёздами ───
  let ratingLine = "";
  if (lead.clientRating && lead.clientRating > 0) {
    const stars = "★".repeat(lead.clientRating) + "☆".repeat(Math.max(0, 3 - lead.clientRating));
    ratingLine = `${stars}  рейтинг клиента`;
  }

  // ─── Вероятность реальности ───
  let realnessLine = "";
  if (lead.botProbability !== undefined && lead.botProbability !== null) {
    const realness = 100 - lead.botProbability;
    let emoji: string;
    if (realness >= 90) emoji = "🟢";
    else if (realness >= 70) emoji = "🟡";
    else emoji = "🔴";
    realnessLine = `${emoji} Вероятность реальности: <b>${realness}%</b>`;
  }

  // ─── Подробность ТЗ ───
  let detailLine = "";
  if (lead.descriptionLength !== undefined && lead.descriptionLength > 0) {
    if (lead.descriptionLength > 2000) detailLine = "📝 ТЗ: подробное";
    else if (lead.descriptionLength > 500) detailLine = "📝 ТЗ: среднее";
    else detailLine = "📝 ТЗ: краткое";
  }

  // ─── Собираем сообщение ───
  const lines: string[] = [
    `${header}    ${scoreLine}`,
    "",
    `<b>${escapeHtml(lead.title)}</b>`,
    "",
    `💰 <b>${escapeHtml(lead.budget)}</b>`,
  ];

  if (meta.length > 0) lines.push(meta.join(" · "));
  if (ratingLine) lines.push(ratingLine);
  if (detailLine) lines.push(detailLine);
  lines.push("");
  if (realnessLine) lines.push(realnessLine);
  if (lead.reasoning) lines.push(`💡 ${escapeHtml(lead.reasoning)}`);

  const text = lines.join("\n");

  // ─── Кнопки ───
  const buttons: Array<Array<{ text: string; url: string }>> = [
    [{ text: "🔗 Открыть заказ", url: lead.url }],
  ];

  if (lead.response) {
    buttons.push([{ text: "💬 Скопировать отклик", url: lead.url }]);
  }

  // ─── Отправка ───
  try {
    const body: any = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: buttons },
    };

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });

    const data = await response.json() as { ok: boolean; description?: string };

    if (!data.ok && data.description?.includes("parse")) {
      // HTML не удался — пробуем без форматирования
      const plainBody: any = {
        chat_id: chatId,
        text: text.replace(/<[^>]+>/g, ""),
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: buttons },
      };
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plainBody),
        signal: AbortSignal.timeout(8_000),
      });
      const plainData = await res.json() as { ok: boolean };
      return plainData.ok === true;
    }

    return data.ok === true;
  } catch (error) {
    console.error("[telegram] Ошибка отправки:", error);
    return false;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
