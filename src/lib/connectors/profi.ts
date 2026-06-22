// Коннектор Profi.ru — Playwright (авторизация + парсинг HTML)
// v2: Изолированные браузеры на каждый source (партнёра)
// Каждый партнёр = свой контекст, свои куки, своя сессия

import { chromium, type BrowserContext, type Page } from "playwright";
import type { Connector, ConnectorConfig, NormalizedLead } from "./types";
import { registerConnector } from "./types";

interface ProfiConfig extends ConnectorConfig {
  login?: string;
  password?: string;
  keywords?: string;
}

const LOGIN_URL = "https://profi.ru/backoffice/n.php";

// Кеш на каждый sourceId (а не глобальный!)
const sessionCache = new Map<string, { browser: import("playwright").Browser; page: Page; login: string }>();

async function ensureLoggedIn(sourceId: string, login: string, password: string): Promise<Page | null> {
  // Проверяем — есть ли сессия для ЭТОГО sourceId с ЭТИМ логином
  const cached = sessionCache.get(sourceId);
  if (cached && cached.login === login) {
    try {
      await cached.page.url(); // проверка что жива
      return cached.page;
    } catch {
      // Умерла — удаляем и пересоздаём
      await cached.browser.close().catch(() => {});
      sessionCache.delete(sourceId);
    }
  }

  // Если есть старая сессия с ДРУГИМ логином — закрываем
  if (cached && cached.login !== login) {
    console.log(`[profi] 🔄 Смена логина для source ${sourceId}: ${cached.login} → ${login}`);
    await cached.browser.close().catch(() => {});
    sessionCache.delete(sourceId);
  }

  console.log(`[profi] 🔑 Вход: ${login} (source: ${sourceId})...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector('[data-testid="auth_login_input"]', { timeout: 15000 });
    await page.fill('[data-testid="auth_login_input"]', login);
    await page.locator('input[type="password"]').first().fill(password);
    await page.click('[data-testid="enter_with_sms_btn"]');

    await page.waitForTimeout(6000);

    const url = page.url();
    const bodyText = await page.locator("body").innerText();

    if (bodyText.includes("Некорректный логин") || bodyText.includes("Некорректный пароль")) {
      console.error(`[profi] ❌ Неверный логин/пароль для ${login}`);
      await page.close();
      await browser.close().catch(() => {});
      throw new Error(`Profi.ru: неверный логин или пароль для ${login}`);
    }

    if (url.includes("login") || url.includes("auth")) {
      console.error(`[profi] ❌ Не удалось войти: ${login}`);
      await page.close();
      await browser.close().catch(() => {});
      throw new Error(`Profi.ru: не удалось войти (возможно SMS или капча) для ${login}`);
    }

    console.log(`[profi] ✅ Вход выполнен: ${login} → ${url}`);
    sessionCache.set(sourceId, { browser, page, login });
    return page;
  } catch (err: any) {
    console.error(`[profi] ❌ Ошибка входа для ${login}:`, err?.message || err);
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    // Пробрасываем ошибку чтобы Worker обновил source.status="error"
    throw err instanceof Error ? err : new Error(String(err));
  }
}

function extractBudget(text: string): { min?: number; max?: number } {
  const patterns = [
    /(\d[\d\s]*)\s*(?:руб|₽)/i,
    /бюджет[:\s]*(\d[\d\s]*)/i,
    /от\s*(\d[\d\s]*)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseInt(match[1].replace(/\s/g, ""), 10);
      if (value >= 100) return { min: value };
    }
  }
  return {};
}

function matchesKeywords(text: string, keywords?: string): boolean {
  if (!keywords) return true;
  const kw = keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (kw.length === 0) return true;
  const lower = text.toLowerCase();
  return kw.some((k) => lower.includes(k));
}

export const profiConnector: Connector = {
  platform: "profi",
  name: "Profi.ru",

  validateConfig(config: ConnectorConfig): boolean {
    const c = config as ProfiConfig;
    return !!(c.login && c.password);
  },

  async fetchLeads(config: ConnectorConfig): Promise<NormalizedLead[]> {
    const c = config as ProfiConfig;

    if (!c.login || !c.password) {
      console.warn("[profi] ⚠️ Логин/пароль не настроены");
      return [];
    }

    // sourceId обязателен для изоляции сессий
    const sourceId = (config as any).sourceId as string;
    if (!sourceId) {
      console.error("[profi] ❌ sourceId не передан — невозможно изолировать сессию");
      return [];
    }

    const page = await ensureLoggedIn(sourceId, c.login, c.password);
    if (!page) return [];

    try {
      console.log(`[profi] 📊 Парсинг заказов для ${c.login}...`);

      const leads: NormalizedLead[] = [];
      const seen = new Set<string>();

      const orderLinks = await page.locator('a[href*="?o="]').evaluateAll(
        (els) =>
          els.map((el) => ({
            href: (el as HTMLAnchorElement).href,
            text: (el as HTMLElement).innerText?.trim() || "",
          }))
      );

      console.log(`[profi] 🔗 Найдено ${orderLinks.length} ссылок для ${c.login}`);

      for (const link of orderLinks) {
        if (!link.text || seen.has(link.href)) continue;
        seen.add(link.href);

        if (!matchesKeywords(link.text, c.keywords)) continue;

        const budget = extractBudget(link.text);
        // Извлекаем заголовок: пропускаем даты, "false", "true", короткие строки
        const lines = link.text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        const meaningful = lines.filter(l => {
          if (l === "false" || l === "true") return false;
          if (/^\d{1,2}\s+(июня|июля|августа|сентября|октября|ноября|декабря|января|февраля|марта|апреля|мая)/.test(l)) return false;
          if (/^(Вчера|Сегодня|\d+\s+(час|минут|день|дня).*назад)/.test(l)) return false;
          return l.length >= 3;
        });
        const title = meaningful[0]?.slice(0, 150) || "Заказ";

        leads.push({
          externalId: link.href.replace(/&analytics_data=.*$/, ""),
          title,
          description: link.text.slice(0, 1000),
          budgetMin: budget.min,
          url: link.href,
          createdAt: new Date().toISOString(),
        });
      }

      if (leads.length === 0) {
        const snippets = await page.locator('[class*="snippet"], [class*="order"], [data-testid$="snippet"]').evaluateAll(
          (els) =>
            els.map((el) => ({
              text: (el as HTMLElement).innerText?.trim()?.slice(0, 200) || "",
              html: (el as HTMLElement).outerHTML?.slice(0, 300) || "",
            }))
        );

        for (const snippet of snippets) {
          if (!snippet.text || snippet.text.length < 10) continue;
          if (!matchesKeywords(snippet.text, c.keywords)) continue;

          const budget = extractBudget(snippet.text);
          // Генерируем стабильный ID из текста чтобы избежать дубликатов
          const id = `profi-${snippet.text.slice(0, 80).replace(/[^a-zа-яё0-9]/gi, "").slice(0, 30)}`;
          const sLines = snippet.text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
          const sMeaningful = sLines.filter(l => {
            if (l === "false" || l === "true") return false;
            if (/^\d{1,2}\s+(июня|июля|августа|сентября|октября|ноября|декабря|января|февраля|марта|апреля|мая)/.test(l)) return false;
            if (/^(Вчера|Сегодня|\d+\s+(час|минут|день|дня).*назад)/.test(l)) return false;
            return l.length >= 3;
          });

          leads.push({
            externalId: id,
            title: sMeaningful[0]?.slice(0, 150) || "Заказ",
            description: snippet.text.slice(0, 1000),
            budgetMin: budget.min,
            url: LOGIN_URL,
            createdAt: new Date().toISOString(),
          });
        }
      }

      console.log(`[profi] ✅ ${c.login}: собрано ${leads.length} заявок`);
      return leads;
    } catch (err) {
      console.error(`[profi] ❌ Ошибка парсинга для ${c.login}:`, err);
      sessionCache.delete(sourceId);
      return [];
    }
  },
};


// ─── Глубокий просмотр страницы заявки ─────────────────────────────────

export interface OrderDetails {
  author?: string;
  reviewCount?: number;
  rating?: number;
  clientRating?: number;
  fullDescription?: string;
  city?: string;
  lastOnline?: string;
  budgetRaw?: string;
}

export async function scrapeOrderPage(sourceId: string, orderUrl: string): Promise<OrderDetails | null> {
  let deepPage: any = null;
  try {
    const cached = sessionCache.get(sourceId);
    if (!cached) {
      console.log("[profi] ⚠️ Нет активной сессии для deep scan");
      return null;
    }

    // Используем ОТДЕЛЬНУЮ страницу чтобы не мешать основному сбору
    const ctx = cached.page.context();
    
    // Очищаем URL от аналитических параметров
    const cleanUrl = orderUrl.replace(/&analytics_data=.*$/, '');
    console.log(`[profi] 🔍 Глубокий просмотр: ${cleanUrl.slice(0, 60)}...`);

    deepPage = await ctx.newPage();
    await deepPage.goto(cleanUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await deepPage.waitForTimeout(2000);

    const bodyText = await deepPage.locator("body").innerText();
    console.log(`[profi] 📄 Тело страницы (первые 400): ${bodyText.slice(0, 400).replace(/\n/g, " | ")}`);
    
    const details: OrderDetails = {};

    // Имя заказчика
    // Ищем имя: на Profi имя после инициала на отдельных строках
    // "А\n\nАнгелина" или "А\nАртем"
    let nameMatch = bodyText.match(/[А-ЯЁ]\s*\n\s*\n?\s*([А-ЯЁ][а-яё]+)/);
    if (!nameMatch) nameMatch = bodyText.match(/[А-ЯЁ]\s*\n\s*([А-ЯЁ][а-яё]+)/);
    if (!nameMatch) nameMatch = bodyText.match(/(?:Заказчик|Исполнитель)[:\s]*([А-ЯЁ][а-яё]+)/i);
    if (nameMatch) details.author = nameMatch[1].trim();

    // Количество отзывов
    const reviewMatch = bodyText.match(/(?:Оставил[аи]?\s*)(\d+)\s*(?:отзыв|отзыва|отзывов)/i) || bodyText.match(/(\d+)\s*(?:отзыв|отзыва|отзывов)/i);
    if (reviewMatch) details.reviewCount = parseInt(reviewMatch[1]);

    // Дата регистрации на Profi: "На Профи.рус 04 марта 2018"
    const regMatch = bodyText.match(/На Профи\.рус\s+(\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4}))/i);
    let monthsOnPlatform = 0;
    if (regMatch) {
      const months: Record<string,number> = {января:0,февраля:1,марта:2,апреля:3,мая:4,июня:5,июля:6,августа:7,сентября:8,октября:9,ноября:10,декабря:11};
      const [_, day, monthName, year] = regMatch;
      const regDate = new Date(parseInt(year), months[monthName.toLowerCase()] || 0, parseInt(day));
      monthsOnPlatform = Math.floor((Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    }

    // Оценка клиента 1-3 ★
    let clientScore = 0;
    // Критерий 1: время на платформе
    if (monthsOnPlatform >= 24) clientScore += 1.5;      // 2+ года
    else if (monthsOnPlatform >= 6) clientScore += 0.8;   // полгода+
    else if (monthsOnPlatform > 0) clientScore += 0.3;    // новичок
    
    // Критерий 2: отзывы
    const revs = details.reviewCount || 0;
    if (revs >= 10) clientScore += 1.5;     // много отзывов
    else if (revs >= 3) clientScore += 0.8;  // несколько
    else if (revs >= 1) clientScore += 0.3;  // есть хоть один
    
    // Итог: округляем до 1-3
    if (clientScore >= 2.2) details.clientRating = 3;
    else if (clientScore >= 1.1) details.clientRating = 2;
    else if (clientScore > 0) details.clientRating = 1;

    // Рейтинг
    const ratingMatch = bodyText.match(/(?:рейтинг|rating)[:\s]*(\d+[.,]\d+)/i);
    if (ratingMatch) details.rating = parseFloat(ratingMatch[1].replace(",", "."));

    // Город
    const cityMatch = bodyText.match(/(?:Москва|СПб|Санкт-Петербург|Казань|Новосибирск|Екатеринбург|Нижний Новгород|Челябинск|Красноярск|Самара|Омск|Ростов|Уфа|Волгоград|Пермь|Воронеж|Краснодар)/i);
    if (cityMatch) details.city = cityMatch[0];

    // Последняя активность
    const onlineMatch = bodyText.match(/(?:был[а]?\s*(?:в сети|онлайн)|онлайн)\s*(.+?)(?:\n|$)/i);
    if (onlineMatch) details.lastOnline = onlineMatch[1].trim();

    // Полное описание (всё что после заголовка до "Пожелания" или "Город")
    const descParts = bodyText.split(/Пожелания и особенности|Город|Дистанционно/i);
    if (descParts.length > 1) {
      details.fullDescription = descParts[1].trim().slice(0, 2000);
    }

    // Бюджет
    const budgetMatch = bodyText.match(/(?:бюджет|стоимость|цена)[:\s]*(\d[\d\s]*)\s*(?:руб|₽)/i);
    if (budgetMatch) details.budgetRaw = budgetMatch[1].replace(/\s/g, "");

    console.log(`[profi] ✅ Глубокий просмотр: автор=${details.author || '?'} отзывов=${details.reviewCount || 0}`);
    await deepPage.close().catch(() => {});
    return details;
  } catch (err: any) {
    await deepPage.close().catch(() => {});
    console.error(`[profi] ❌ Ошибка глубокого просмотра:`, err.message);
    return null;
  }
}

registerConnector(profiConnector);

// При выходе — закрываем все браузеры
process.on("exit", () => {
  for (const [, session] of sessionCache) {
    session.browser.close().catch(() => {});
  }
  sessionCache.clear();
});
