// Telegram-уведомления — v4: бюджет в плашках, две кнопки

export interface LeadNotification {
  platform: string;
  platformColor: string;
  score: number;
  title: string;
  budget: string;
  url: string;
  reasoning: string;
  author?: string;
  reviewCount?: number;
  yearsOnPlatform?: number;
  monthsOnPlatform?: number;
  clientRating?: number;
  city?: string;
  deadline?: string;
  responsePrice?: number;
  botProbability?: number;
  descriptionLength?: number;
  response?: string;
  responseText?: string;
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

  // Заголовок
  let header: string;
  if (score >= 85) header = `🔥 <b>ГОРЯЧИЙ ЛИД</b> · ${lead.platform}`;
  else if (score >= 70) header = `⭐ <b>Хороший лид</b> · ${lead.platform}`;
  else if (score >= 40) header = `💡 <b>Заявка</b> · ${lead.platform}`;
  else header = `📌 <b>Заявка</b> · ${lead.platform}`;

  const scoreLine = score > 0 ? `  <b>${score}/100</b>` : "";

  // Rich-мета
  const meta: string[] = [];
  if (lead.reviewCount && lead.reviewCount > 0) meta.push(`⭐ ${lead.reviewCount} отз.`);
  if (lead.yearsOnPlatform && lead.yearsOnPlatform > 0) meta.push(`📅 ${lead.yearsOnPlatform} г.`);
  else if (lead.monthsOnPlatform && lead.monthsOnPlatform > 0) meta.push(`📅 ${lead.monthsOnPlatform} мес.`);
  if (lead.author) meta.push(`👤 ${lead.author}`);
  if (lead.city) meta.push(`📍 ${lead.city}`);
  if (lead.deadline) meta.push(`⏰ ${lead.deadline}`);

  let ratingLine = "";
  if (lead.clientRating && lead.clientRating > 0) {
    const stars = "★".repeat(lead.clientRating) + "☆".repeat(Math.max(0, 3 - lead.clientRating));
    ratingLine = `${stars}  рейтинг клиента`;
  }

  let realnessLine = "";
  if (lead.botProbability !== undefined && lead.botProbability !== null) {
    const realness = 100 - lead.botProbability;
    const emoji = realness >= 90 ? "🟢" : realness >= 70 ? "🟡" : "🔴";
    realnessLine = `${emoji} Реальность: <b>${realness}%</b>`;
  }

  let detailLine = "";
  if (lead.descriptionLength && lead.descriptionLength > 0) {
    detailLine = lead.descriptionLength > 2000 ? "📝 ТЗ: подробное" : lead.descriptionLength > 500 ? "📝 ТЗ: среднее" : "📝 ТЗ: краткое";
  }

  let respLine = "";
  if (lead.responsePrice && lead.responsePrice > 0) {
    respLine = `🎯 <b>Отклик: ${lead.responsePrice} ₽</b>`;
  }

  // ═══ Собираем карточку ═══════════════════════════════════════════

  const lines: string[] = [
    `${header}${scoreLine}`,
    "",
    `<b>${escapeHtml(lead.title)}</b>`,
    "",
    `━━━ 💰 БЮДЖЕТ ━━━`,
    `<b>${escapeHtml(lead.budget)}</b>`,
  ];

  if (respLine) lines.push(respLine);

  lines.push(`━━━━━━━━━━━━━━━━━`);

  if (meta.length > 0) lines.push(meta.join(" · "));
  if (ratingLine) lines.push(ratingLine);
  if (detailLine) lines.push(detailLine);
  if (realnessLine) lines.push(realnessLine);

  if (lead.reasoning) {
    lines.push("");
    const preview = escapeHtml(lead.reasoning.slice(0, 300));
    lines.push(`💡 ${preview}${lead.reasoning.length > 150 ? "..." : ""}`);
    lines.push("");
  }

  // Бюджет снизу ещё раз
  lines.push(`━━━ 💰 <b>${escapeHtml(lead.budget)}</b> ━━━`);

  const text = lines.join("\n");

  // ═══ Кнопки (две в ряд) ══════════════════════════════════════════
  const buttons: Array<Array<{ text: string; url?: string }>> = [
    [
      { text: "🔗 Открыть заказ", url: lead.url },
      { text: "⭐ В избранное", url: lead.url },
    ],
  ];

  if (lead.responseText) {
    buttons.push([{ text: "💬 Отклик (текст готов)", url: lead.url }]);
    lines.push("");
    lines.push("💬 <b>Готовый отклик:</b>");
    lines.push("<code>" + escapeHtml(lead.responseText.slice(0, 500)) + "</code>");
    lines.push("<i>Скопируйте текст и отправьте на Profi</i>");
  } else if (lead.response) {
    buttons.push([{ text: "💬 Отклик", url: lead.url }]);
  }

  try {
    const body: any = {
      chat_id: chatId, text, parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: buttons },
    };
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
    });
    const data = await response.json() as { ok: boolean; description?: string };
    if (!data.ok && data.description?.includes("parse")) {
      const plainBody: any = {
        chat_id: chatId, text: text.replace(/<[^>]+>/g, ""),
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: buttons },
      };
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plainBody), signal: AbortSignal.timeout(8000),
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
