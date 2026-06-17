// Коннектор Profi.ru
// Парсит RSS-ленту заказов и нормализует данные

import type { Connector, ConnectorConfig, NormalizedLead } from "./types";
import { registerConnector } from "./types";

const PROFI_RSS_URL = "https://profi.ru/rss/orders";

interface ProfiConfig extends ConnectorConfig {
  categories?: string[];  // категории для фильтрации
  keywords?: string;      // ключевые слова через запятую
}

function extractBudget(text: string): { min?: number; max?: number } {
  // Ищем паттерны: "бюджет 50000", "от 30000 до 100000", "50000 руб"
  const patterns = [
    /бюджет[:\s]*(\d[\d\s]*)\s*(?:руб|₽)?/i,
    /от\s*(\d[\d\s]*)\s*(?:руб|₽)?/i,
    /(\d[\d\s]*)\s*(?:руб|₽)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseInt(match[1].replace(/\s/g, ""), 10);
      return { min: value };
    }
  }

  return {};
}

function extractCity(text: string): string | undefined {
  const cityMatch = text.match(/(?:город|г\.|в\s+г\.)\s*([А-ЯЁ][а-яё\-]+)/i);
  return cityMatch?.[1];
}

export const profiConnector: Connector = {
  platform: "profi",
  name: "Profi.ru",

  validateConfig(config: ConnectorConfig): boolean {
    return true; // Profi не требует авторизации для RSS
  },

  async fetchLeads(config: ConnectorConfig): Promise<NormalizedLead[]> {
    const profiConfig = config as ProfiConfig;

    try {
      const response = await fetch(PROFI_RSS_URL, {
        signal: AbortSignal.timeout(30_000),
        headers: {
          "User-Agent": "Konversus-Leads-AI/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(`Profi.ru ответил ${response.status}`);
      }

      const xml = await response.text();
      return parseProfiRSS(xml, profiConfig);
    } catch (error) {
      console.error("[profi] Ошибка загрузки:", error);
      return [];
    }
  },
};

function parseProfiRSS(xml: string, config: ProfiConfig): NormalizedLead[] {
  const leads: NormalizedLead[] = [];

  // Простой парсинг RSS без XML-библиотек
  const items = xml.split("<item>").slice(1);

  for (const item of items) {
    const title = extractTag(item, "title");
    const description = extractTag(item, "description");
    const link = extractTag(item, "link");
    const pubDate = extractTag(item, "pubDate");
    const author = extractTag(item, "author");

    if (!title || !description) continue;

    // Фильтр по ключевым словам
    if (config.keywords) {
      const keywords = config.keywords.split(",").map(k => k.trim().toLowerCase());
      const text = `${title} ${description}`.toLowerCase();
      const matches = keywords.some(kw => text.includes(kw));
      if (!matches) continue;
    }

    const fullText = `${title} ${description}`;
    const budget = extractBudget(fullText);

    leads.push({
      externalId: link || title,
      title,
      description: description.slice(0, 1000),
      budgetMin: budget.min,
      budgetMax: budget.max,
      url: link || "",
      city: extractCity(fullText),
      author: author || undefined,
      createdAt: pubDate || new Date().toISOString(),
    });
  }

  return leads;
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i"))
    || xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1]?.trim() || "";
}

registerConnector(profiConnector);
