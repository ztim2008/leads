import type { IntentMatch } from "./types";
import {
  extractEmail,
  extractIp,
  extractHostname,
  extractLimit,
  parseVpsBlock,
} from "./parse-local";

function withEmail(text: string, type: IntentMatch["type"], extra: Record<string, string | number | boolean> = {}): IntentMatch | null {
  const email = extractEmail(text);
  if (!email && type !== "list_partners" && type !== "help" && type !== "unknown" && type !== "vps_hint") {
    return { type: "unknown", params: {}, confidence: 0 };
  }
  return { type, params: { ...extra, ...(email ? { email } : {}) }, confidence: 0.85 };
}

export function matchIntent(text: string): IntentMatch {
  const lower = text.toLowerCase().trim();
  const vps = parseVpsBlock(text);

  if (vps.ip || vps.hostname) {
    const email = vps.email || extractEmail(text);
    if (email) {
      return {
        type: "save_vps_ip",
        params: { email, vpsIp: vps.ip || "" },
        confidence: 0.9,
      };
    }
    return {
      type: "vps_hint",
      params: { vpsIp: vps.ip || "", hostname: vps.hostname || "" },
      confidence: 0.8,
    };
  }

  if (/^(помощь|help|команды|\?)$/i.test(lower) || /что ты умеешь/i.test(lower)) {
    return { type: "help", params: {}, confidence: 1 };
  }

  if (/список|все партн|покажи партн|кто подключен/i.test(lower)) {
    return { type: "list_partners", params: {}, confidence: 0.9 };
  }

  if (/создай|новый партн|добавь партн|подключи партн/i.test(lower)) {
    const email = extractEmail(text);
    const limit = extractLimit(text);
    return {
      type: "create_partner",
      params: {
        ...(email ? { email } : {}),
        ...(limit ? { leadsPerMonth: limit } : {}),
      },
      confidence: email ? 0.85 : 0.7,
    };
  }

  if (/продли|оплат|\+ месяц|новый месяц/i.test(lower)) {
    return withEmail(text, "renew_month") || { type: "unknown", params: {}, confidence: 0 };
  }

  if (/останов|стоп|выключ.*сбор|пауз/i.test(lower)) {
    const m = withEmail(text, "toggle_collection", { enabled: false });
    return m || { type: "unknown", params: {}, confidence: 0 };
  }

  if (/включ|запуст.*сбор|сбор вкл/i.test(lower)) {
    const m = withEmail(text, "toggle_collection", { enabled: true });
    return m || { type: "unknown", params: {}, confidence: 0 };
  }

  if (/telegram|телеграм|тг тест|провер.*тг/i.test(lower)) {
    return withEmail(text, "test_telegram") || { type: "unknown", params: {}, confidence: 0 };
  }

  if (/команда|install|установ|curl|vps/i.test(lower)) {
    return withEmail(text, "get_install_command") || { type: "unknown", params: {}, confidence: 0 };
  }

  if (/статус|проверь|онлайн|агент/i.test(lower)) {
    return withEmail(text, "partner_status") || { type: "unknown", params: {}, confidence: 0 };
  }

  const loneEmail = extractEmail(text);
  if (loneEmail && text.trim().length < 60) {
    return { type: "partner_status", params: { email: loneEmail }, confidence: 0.6 };
  }

  const loneIp = extractIp(text);
  if (loneIp) {
    return { type: "vps_hint", params: { vpsIp: loneIp }, confidence: 0.5 };
  }

  return { type: "unknown", params: {}, confidence: 0 };
}

export const HELP_TEXT = `Команды помощника (без SSH — только API):

• «список партнёров» — все подключённые
• «статус partner@email.ru» — агент, лимит, сбор
• «создай партнёра email@… лимит 500» — с подтверждением
• «продли partner@email.ru» — новый месяц + сброс счётчика
• «останови сбор partner@…» / «включи сбор …»
• «тест telegram partner@…»
• «команда vps partner@…» — curl install.sh
• Вставьте IP VPS + email партнёра — сохраню IP (пароль не сохраняем)

Полная форма: вкладка «+ Подключить».`;
