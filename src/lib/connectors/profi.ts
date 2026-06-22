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
      return null;
    }

    if (url.includes("login") || url.includes("auth")) {
      console.error(`[profi] ❌ Не удалось войти: ${login}`);
      await page.close();
      await browser.close().catch(() => {});
      return null;
    }

    console.log(`[profi] ✅ Вход выполнен: ${login} → ${url}`);
    sessionCache.set(sourceId, { browser, page, login });
    return page;
  } catch (err) {
    console.error(`[profi] ❌ Ошибка входа для ${login}:`, err);
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    return null;
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
        const title = link.text.split("\n")[0]?.slice(0, 150) || "Заказ";

        leads.push({
          externalId: link.href,
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
          const id = `profi-${Date.now()}-${leads.length}`;

          leads.push({
            externalId: id,
            title: snippet.text.split("\n")[0]?.slice(0, 150) || "Заказ",
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

registerConnector(profiConnector);

// При выходе — закрываем все браузеры
process.on("exit", () => {
  for (const [, session] of sessionCache) {
    session.browser.close().catch(() => {});
  }
  sessionCache.clear();
});
