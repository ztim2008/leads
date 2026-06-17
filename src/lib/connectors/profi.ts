// Коннектор Profi.ru — HTTP + куки сессии
// Пользователь копирует куки из браузера → вставляет в настройки источника
// Коннектор делает HTTP-запросы с этими куками и парсит HTML

import type { Connector, ConnectorConfig, NormalizedLead } from "./types";
import { registerConnector } from "./types";

interface ProfiConfig extends ConnectorConfig {
  cookies?: string;        // строка кук из браузера
  keywords?: string;       // ключевые слова через запятую
}

const PROFI_BASE = "https://profi.ru";
const PROFI_CABINET = "https://profi.ru/cabinet/";

/**
 * Парсит строку кук из браузера в формате:
 * "name1=value1; name2=value2" или "name1=value1\nname2=value2"
 */
function parseCookies(cookieString: string): string {
  return cookieString
    .replace(/\n/g, "; ")
    .replace(/^cookie:\s*/i, "")
    .trim();
}

/**
 * Проверяет, что куки ещё живые (есть хотя бы одна непустая пара)
 */
function isValidCookies(cookieString?: string): boolean {
  if (!cookieString || cookieString.trim().length === 0) return false;
  const cleaned = parseCookies(cookieString);
  return cleaned.includes("=") && cleaned.length > 10;
}

/**
 * Извлекает бюджет из текста заявки
 */
function extractBudget(text: string): { min?: number; max?: number } {
  const patterns = [
    /бюджет[:\s]*(\d[\d\s]*)\s*(?:руб|₽)?/i,
    /от\s*(\d[\d\s]*)\s*(?:руб|₽)?/i,
    /(\d[\d\s]*)\s*(?:руб|₽)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseInt(match[1].replace(/\s/g, ""), 10);
      if (value >= 1000) return { min: value };
    }
  }
  return {};
}

/**
 * Проверяет соответствие ключевым словам
 */
function matchesKeywords(text: string, keywords?: string): boolean {
  if (!keywords) return true;
  const kw = keywords
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  if (kw.length === 0) return true;
  const lower = text.toLowerCase();
  return kw.some((k) => lower.includes(k));
}

/**
 * Достаёт текст между двумя подстроками
 */
function extractBetween(html: string, start: string, end: string): string {
  const idx = html.indexOf(start);
  if (idx === -1) return "";
  const from = idx + start.length;
  const to = html.indexOf(end, from);
  if (to === -1) return html.slice(from);
  return html.slice(from, to);
}

/**
 * Парсит HTML страницы заказов Profi.ru
 */
function parseOrdersHtml(html: string): NormalizedLead[] {
  const leads: NormalizedLead[] = [];
  const seen = new Set<string>();

  // Ищем все ссылки на заказы
  const linkPattern = /href="(\/(?:tasks|orders|view)\/[^"]+)"/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];
    if (seen.has(href)) continue;
    seen.add(href);

    // Извлекаем текст вокруг ссылки (контекст до 300 символов)
    const pos = html.indexOf(href);
    const contextStart = Math.max(0, pos - 300);
    const contextEnd = Math.min(html.length, pos + href.length + 500);
    const context = html.slice(contextStart, contextEnd);

    // Чистим HTML-теги для получения текста
    const cleanText = context
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&laquo;/g, "«")
      .replace(/&raquo;/g, "»")
      .replace(/&mdash;/g, "—")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    const budget = extractBudget(cleanText);
    const title = cleanText.slice(0, 150) || "Заказ с Profi.ru";

    leads.push({
      externalId: href,
      title,
      description: cleanText.slice(0, 1000),
      budgetMin: budget.min,
      budgetMax: budget.max,
      url: href.startsWith("http") ? href : `${PROFI_BASE}${href}`,
      city: undefined,
      author: undefined,
      createdAt: new Date().toISOString(),
    });
  }

  // Если ссылок не нашли — ищем карточки заказов по классам
  if (leads.length === 0) {
    const cardClasses = [
      'class="[^"]*order[^"]*"',
      'class="[^"]*task[^"]*"',
      'class="[^"]*request[^"]*"',
      'class="[^"]*item[^"]*"',
    ];

    for (const cls of cardClasses) {
      const cardPattern = new RegExp(`<div[^>]*${cls}[^>]*>([\\s\\S]*?)</div>`, "gi");
      while ((match = cardPattern.exec(html)) !== null) {
        const cardHtml = match[0];
        const cleanText = cardHtml
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        if (cleanText.length < 20) continue;

        const budget = extractBudget(cleanText);
        const id = `profi-${Date.now()}-${leads.length}`;

        leads.push({
          externalId: id,
          title: cleanText.slice(0, 150),
          description: cleanText.slice(0, 1000),
          budgetMin: budget.min,
          budgetMax: budget.max,
          url: PROFI_CABINET,
          city: undefined,
          author: undefined,
          createdAt: new Date().toISOString(),
        });
      }
      if (leads.length > 0) break;
    }
  }

  return leads;
}

export const profiConnector: Connector = {
  platform: "profi",
  name: "Profi.ru",

  validateConfig(config: ConnectorConfig): boolean {
    return isValidCookies((config as ProfiConfig).cookies);
  },

  async fetchLeads(config: ConnectorConfig): Promise<NormalizedLead[]> {
    const profiConfig = config as ProfiConfig;

    if (!isValidCookies(profiConfig.cookies)) {
      console.warn("[profi] Куки не настроены или пустые. Добавьте куки в настройках источника.");
      return [];
    }

    const cookieHeader = parseCookies(profiConfig.cookies!);

    try {
      console.log("[profi] Загружаю страницу заказов...");
      const response = await fetch(PROFI_CABINET, {
        headers: {
          "Cookie": cookieHeader,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "ru-RU,ru;q=0.9",
        },
        signal: AbortSignal.timeout(30_000),
        redirect: "follow",
      });

      if (!response.ok) {
        console.error(`[profi] HTTP ${response.status}: ${response.statusText}`);
        return [];
      }

      const html = await response.text();

      // Проверяем, не редиректнуло ли на страницу логина
      if (
        html.includes("Вход и регистрация") ||
        html.includes("cabinet/login") ||
        html.includes("Введите регион или город")
      ) {
        console.warn("[profi] ⚠️ Куки протухли — сессия истекла. Обновите куки в настройках.");
        console.warn("[profi] Инструкция: F12 → Application → Cookies → profi.ru → скопировать все куки");
        return [];
      }

      // Ищем заказы
      const leads = parseOrdersHtml(html);

      // Фильтруем по ключевым словам
      const filtered = profiConfig.keywords
        ? leads.filter((l) =>
            matchesKeywords(`${l.title} ${l.description}`, profiConfig.keywords)
          )
        : leads;

      console.log(`[profi] Найдено ${leads.length} заявок, после фильтра: ${filtered.length}`);
      return filtered;
    } catch (error) {
      console.error("[profi] Ошибка загрузки:", error);
      return [];
    }
  },
};

registerConnector(profiConnector);
