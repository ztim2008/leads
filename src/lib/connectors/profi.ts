// Коннектор Profi.ru — Playwright (авторизация + парсинг HTML)
// Входит через backoffice, парсит карточки заказов со страницы
// Надёжнее чем GraphQL — не требует API-доступа

import { chromium, type BrowserContext } from "playwright";
import type { Connector, ConnectorConfig, NormalizedLead } from "./types";
import { registerConnector } from "./types";

interface ProfiConfig extends ConnectorConfig {
  login?: string;
  password?: string;
  keywords?: string;
}

const LOGIN_URL = "https://profi.ru/backoffice/n.php";

let cachedPage: import("playwright").Page | null = null;
let cachedBrowser: import("playwright").Browser | null = null;

async function ensureLoggedIn(login: string, password: string): Promise<import("playwright").Page | null> {
  if (cachedPage) {
    try {
      // Проверяем что страница жива
      await cachedPage.url();
      return cachedPage;
    } catch {
      cachedPage = null;
    }
  }

  console.log("[profi] 🔑 Вход через Playwright...");

  if (cachedBrowser) {
    await cachedBrowser.close().catch(() => {});
    cachedBrowser = null;
  }

  const browser = await chromium.launch({ headless: true });
  cachedBrowser = browser;
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector('[data-testid="auth_login_input"]', { timeout: 15000 });
    await page.fill('[data-testid="auth_login_input"]', login);
    await page.locator('input[type="password"]').first().fill(password);
    await page.click('[data-testid="enter_with_sms_btn"]');

    // Ждём загрузки кабинета
    await page.waitForTimeout(6000);

    const url = page.url();
    const bodyText = await page.locator("body").innerText();

    if (bodyText.includes("Некорректный логин") || bodyText.includes("Некорректный пароль")) {
      console.error("[profi] ❌ Неверный логин или пароль");
      await page.close();
      return null;
    }

    if (url.includes("login") || url.includes("auth")) {
      console.error("[profi] ❌ Не удалось войти");
      await page.close();
      return null;
    }

    console.log("[profi] ✅ Вход выполнен:", url);
    cachedPage = page;
    return page;
  } catch (err) {
    console.error("[profi] ❌ Ошибка входа:", err);
    await page.close().catch(() => {});
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

    const page = await ensureLoggedIn(c.login, c.password);
    if (!page) return [];

    try {
      console.log("[profi] 📊 Парсинг заказов...");

      // Парсим карточки заказов со страницы
      const leads: NormalizedLead[] = [];
      const seen = new Set<string>();

      // Ищем ссылки на заказы (формат: ?o=<id>)
      const orderLinks = await page.locator('a[href*="?o="]').evaluateAll(
        (els) =>
          els.map((el) => ({
            href: (el as HTMLAnchorElement).href,
            text: (el as HTMLElement).innerText?.trim() || "",
          }))
      );

      console.log(`[profi] 🔗 Найдено ${orderLinks.length} ссылок на заказы`);

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

      // Если ссылок нет — пробуем другие селекторы
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

      console.log(`[profi] ✅ Собрано ${leads.length} заявок`);
      return leads;
    } catch (err) {
      console.error("[profi] ❌ Ошибка парсинга:", err);
      // Сбрасываем кеш страницы при ошибке
      cachedPage = null;
      return [];
    }
  },
};

registerConnector(profiConnector);

process.on("exit", () => {
  if (cachedBrowser) cachedBrowser.close().catch(() => {});
  cachedBrowser = null;
  cachedPage = null;
});
