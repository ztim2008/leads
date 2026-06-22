// Telegram-уведомления о новых заявках
// Отправляет сообщения с кнопками через Telegram Bot API

export interface LeadNotification {
  platform: string;
  platformColor: string;
  score: number;
  title: string;
  budget: string;
  url: string;
  reasoning: string;
  response?: string;
  description?: string; // сгенерированный отклик
}

const SCORE_EMOJI: Record<string, string> = {
  "Откликнуться": "🟢",
  "Подумать": "🟡",
  "Пропустить": "🔴",
};

const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

export async function sendLeadNotification(
  chatId: string,
  lead: LeadNotification,
  botToken?: string
): Promise<boolean> {
  const token = botToken || DEFAULT_BOT_TOKEN;
  if (!token || !chatId) return false;

  const emoji = SCORE_EMOJI[lead.reasoning.includes("Откликнуться") ? "Откликнуться" :
    lead.reasoning.includes("Подумать") ? "Подумать" : "Пропустить"] || "⚪";

  const scoreBar = lead.score >= 85 ? "🔥" : lead.score >= 70 ? "⭐" : lead.score >= 40 ? "💡" : "📌";

  const text = [
    `${emoji} ${lead.platform.toUpperCase()}`,
    ``,
    `${scoreBar} ${lead.score}/100`,
    ``,
    `*${escapeMarkdown(lead.title)}*`,
    ``,
    `💰 ${escapeMarkdown(lead.budget)}`,
    ``,
    `_${escapeMarkdown(lead.reasoning)}_`,
    lead.description ? `\n${escapeMarkdown(lead.description.slice(0, 200))}...` : "",
  ].join("\n");

  const buttons = [
    [{ text: "🔗 Открыть заявку", url: lead.url }],
  ];

  if (lead.response) {
    buttons.push([{ text: "📋 Скопировать отклик", url: `copy_response_${lead.url}` }]);
  }

  // Пробуем с Markdown, при ошибке парсинга — без форматирования
  const send = async (useMarkdown: boolean) => {
    const body: any = {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: buttons },
    };
    if (useMarkdown) body.parse_mode = "Markdown";
    
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
    return response.json() as Promise<{ ok: boolean; description?: string }>;
  };

  try {
    let data = await send(true);
    if (!data.ok && data.description?.includes("parse")) {
      // Markdown не удался — пробуем без форматирования
      data = await send(false);
    }
    return data.ok === true;
  } catch (error) {
    console.error("[telegram] Ошибка отправки:", error);
    return false;
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
