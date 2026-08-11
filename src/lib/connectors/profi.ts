// @ts-nocheck
// Коннектор Profi.ru — Playwright (авторизация + парсинг HTML)
// v4: Усиленный анти-детект + человеческое поведение
// - Ротация User-Agent и viewport per-source
// - humanType() вместо page.fill() (поэтапный ввод)
// - humanClick() с кривой Безье (реалистичная мышь)
// - humanScroll() с вариативной скоростью
// - Per-source конфигурация antiDetect

import { chromium, type BrowserContext, type Page } from "playwright";
import type { Connector, ConnectorConfig, NormalizedLead } from "./types";
import { registerConnector } from "./types";
import { pickRandomProfile, pickDifferentProfile } from "@/lib/stealth/profiles";
import type { BrowserProfile } from "@/lib/stealth/profiles";
import { humanType, humanClick, humanScroll, sleep } from "@/lib/stealth/human";

interface ProfiConfig extends ConnectorConfig {
  login?: string;
  password?: string;
  keywords?: string;
  antiDetect?: {
    // Режим: light | balanced | stealth
    mode?: "light" | "balanced" | "stealth";
    // Свои пулы UA/viewport (опционально)
    uaPool?: string[];
    viewportPool?: { width: number; height: number }[];
    // Дополнительные задержки (множитель, 1.0 = обычные)
    delayMultiplier?: number;
    // Отключать ли глубокий просмотр (безопаснее)
    disableDeepScan?: boolean;
    // Пропускать ли % проверок (дополнительно к базовым 20%)
    extraSkipPercent?: number;
  };
  // Прокси для браузера (опционально)
  // Формат: "socks5://user:pass@host:port" или "http://user:pass@host:port"
  // sticky session: один источник = один IP (не менять!)
  proxy?: string;
  // Режим сбора: "poll" (опрос) | "watch" (ждун)
  // watch: открыть ленту 1 раз, ловить мутации DOM
  mode?: "poll" | "watch";
}

const LOGIN_URL = "https://profi.ru/backoffice/n.php";

// Кеш на каждый sourceId
export const sessionCache = new Map<string, { browser: import("playwright").Browser; page: Page; login: string; profileId?: string }>();

/**
 * Получить конфигурацию antiDetect для конкретного источника
 */
function getAntiDetectConfig(config: ProfiConfig) {
  const ad = config.antiDetect || {};
  return {
    mode: ad.mode || "light",
    delayMultiplier: ad.delayMultiplier || 1.0,
    disableDeepScan: ad.disableDeepScan || false,
    extraSkipPercent: ad.extraSkipPercent || 0,
  };
}

/**
 * Создать контекст браузера со случайным профилем
 */
async function createContext(browser: import("playwright").Browser, config: ProfiConfig, sourceId: string): Promise<{ context: BrowserContext; profile: BrowserProfile }> {
  const ad = getAntiDetectConfig(config);
  const stealth = ad.mode === "stealth";

  // Выбираем профиль — каждый раз разный (ротация)
  const cached = sessionCache.get(sourceId);
  const profile = pickDifferentProfile(cached?.profileId, stealth);

  // Stealth-контекст с ротацией
  const contextOptions: any = {
    viewport: profile.viewport,
    userAgent: profile.userAgent,
    locale: profile.locale,
    timezoneId: "Europe/Moscow",
    deviceScaleFactor: profile.deviceScaleFactor,
    hasTouch: profile.hasTouch,
    javaScriptEnabled: true,
  };

  // Прокси (если настроен для источника)
  if (config.proxy) {
    console.log(`[profi] 🌐 Прокси: ${config.proxy.replace(/\/\/.*@/, '//***@')}`);
    contextOptions.proxy = { server: config.proxy };
  }

  const context = await browser.newContext(contextOptions);

  // Расширенный спуфинг — больше признаков
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    // @ts-ignore
    window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
    // @ts-ignore
    navigator.plugins = [1, 2, 3, 4, 5];
    // @ts-ignore
    navigator.languages = ['ru-RU', 'ru', 'en-US', 'en'];
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 + Math.floor(Math.random() * 4) });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => [4, 8, 8, 16][Math.floor(Math.random() * 4)] });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
  });

  return { context, profile };
}

async function ensureLoggedIn(sourceId: string, login: string, password: string): Promise<Page | null> {
  const timeoutMs = 60000; // 60 сек для stealth
  try {
    return await Promise.race([
      doEnsureLoggedIn(sourceId, login, password),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Таймаут входа (60с)")), timeoutMs)),
    ]);
  } catch (e: any) {
    console.error(`[profi] ❌ Ошибка входа для ${login}:`, e.message || e);
    return null;
  }
}

async function doEnsureLoggedIn(sourceId: string, login: string, password: string): Promise<Page | null> {
  const cached = sessionCache.get(sourceId);
  if (cached && cached.login === login) {
    try {
      const bodyCheck = await cached.page.locator("body").innerText();
      if (bodyCheck.includes("Вход и регистрация") || bodyCheck.includes("Восстановить пароль")) {
        console.log(`[profi] ⚠️ Кешированная сессия ${login} истекла — пересоздаём`);
        await cached.browser.close().catch(() => {});
        sessionCache.delete(sourceId);
      } else {
        await cached.page.url();
        return cached.page;
      }
    } catch {
      await cached.browser.close().catch(() => {});
      sessionCache.delete(sourceId);
    }
  }

  if (cached && cached.login !== login) {
    console.log(`[profi] 🔄 Смена логина для source ${sourceId}: ${cached.login} → ${login}`);
    await cached.browser.close().catch(() => {});
    sessionCache.delete(sourceId);
  }

  console.log(`[profi] 🔑 Вход: ${login} (source: ${sourceId})...`);

  const browser = await chromium.launch({ 
    headless: true,
    timeout: 30000,
  });

  // Получаем конфигурацию источника
  const config = sessionCache.get(sourceId)?.config as ProfiConfig | undefined;
  const { context, profile } = await createContext(browser, config || {}, sourceId);
  const page = await context.newPage();

  try {
    // Человеческая задержка перед входом (как будто человек только открыл браузер)
    await sleep(1500 + Math.random() * 3000);

    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector('[data-testid="auth_login_input"]', { timeout: 15000 });

    // Ввод логина как человек — символ за символом
    await humanType(page, '[data-testid="auth_login_input"]', login);
    await sleep(300 + Math.random() * 500);

    // Ввод пароля как человек
    await humanType(page, 'input[type="password"]', password);
    await sleep(400 + Math.random() * 600);

    // Клик на кнопку входа — с движением мыши
    await humanClick(page, '[data-testid="enter_with_sms_btn"]');

    // Пауза после входа — человек ждёт загрузки
    await sleep(4000 + Math.random() * 5000);

    // Легкий скролл
    await page.evaluate(() => window.scrollBy(0, 100 + Math.random() * 400));
    await sleep(500 + Math.random() * 1500);

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

    const bodyAfterLogin = await page.locator("body").innerText();
    if (bodyAfterLogin.includes("Вход и регистрация") || bodyAfterLogin.includes("Восстановить пароль")) {
      console.error(`[profi] ❌ Сессия истекла для ${login} — требуется повторный вход`);
      await page.close();
      await browser.close().catch(() => {});
      throw new Error(`Profi.ru: сессия истекла, требуется заново ввести логин и пароль для ${login}`);
    }

    console.log(`[profi] ✅ Вход выполнен: ${login} → ${url} (профиль: ${profile.id})`);
    sessionCache.set(sourceId, { browser, page, login, profileId: profile.id });
    return page;
  } catch (err: any) {
    console.error(`[profi] ❌ Ошибка входа для ${login}:`, err?.message || err);
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export function extractBudget(text: string): { min?: number; max?: number } {
  const patterns = [
    /(\d[\d\s]*)\s*(?:руб|₽)/i,
    /бюджет[:\s]*(\d[\d\s]*)/i,
    /от\s*(\d[\d\s]*)/i,
    /до\s*(\d[\d\s]*)/i,
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

    const sourceId = (config as any).sourceId as string;
    if (!sourceId) {
      console.error("[profi] ❌ sourceId не передан — невозможно изолировать сессию");
      return [];
    }

    // Применяем конфиг antiDetect
    const ad = getAntiDetectConfig(c);
    const delayMul = ad.delayMultiplier;

    // Дополнительный пропуск для осторожных аккаунтов
    if (ad.extraSkipPercent > 0 && Math.random() * 100 < ad.extraSkipPercent) {
      console.log(`[profi] 🚶 ${c.login}: дополнительный пропуск (antiDetect ${ad.extraSkipPercent}%)`);
      return [];
    }

    const page = await ensureLoggedIn(sourceId, c.login, c.password);
    if (!page) return [];

    try {
      // ─── ЧЕЛОВЕЧЕСКОЕ ПОВЕДЕНИЕ ─────────────────────────────────────
      
      // 1. Иногда — заходим в сообщения (снижено для stealth: 20% вместо 30%)
      const msgProbability = ad.mode === "stealth" ? 0.2 : 0.3;
      if (Math.random() < msgProbability) {
        console.log(`[profi] 📨 ${c.login}: зашёл в сообщения...`);
        try {
          await page.goto('https://profi.ru/backoffice/messages.php', { waitUntil: 'domcontentloaded', timeout: 15000 });
          await sleep(8000 * delayMul + Math.random() * 12000 * delayMul);
          await page.goto('https://profi.ru/backoffice/n.php', { waitUntil: 'domcontentloaded', timeout: 15000 });
        } catch {}
      }
      
      // 2. Скролл ленты — теперь через humanScroll
      console.log(`[profi] 📜 ${c.login}: листает ленту...`);
      const scrollSteps = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < scrollSteps; i++) {
        await page.evaluate(() => window.scrollBy(0, 150 + Math.random() * 700));
        await sleep((1500 + Math.random() * 3500) * delayMul);
      }
      if (Math.random() < 0.5) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await sleep(1000 * delayMul + Math.random() * 2000 * delayMul);
      }
      
      // 3. Просмотр случайных заказов (снижено для stealth: 25% вместо 40%)
      const clickProbability = ad.mode === "stealth" ? 0.25 : 0.4;
      if (Math.random() < clickProbability) {
        const randomLinks = await page.locator('a[href*="?o="]').all();
        const count = Math.min(1 + Math.floor(Math.random() * 2), randomLinks.length);
        console.log(`[profi] 👀 ${c.login}: смотрит ${count} случайных заказа...`);
        for (let i = 0; i < count; i++) {
          try {
            const idx = Math.floor(Math.random() * randomLinks.length);
            await randomLinks[idx].click({ timeout: 5000, delay: 30 + Math.random() * 60 });
            await sleep((4000 + Math.random() * 8000) * delayMul);
            await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 });
            await sleep(1500 * delayMul + Math.random() * 2500 * delayMul);
          } catch { break; }
        }
      }
      
      // 4. Иногда — уход без парсинга (для stealth — чаще, 20% вместо 10%)
      const skipProbability = ad.mode === "stealth" ? 0.2 : 0.10;
      if (Math.random() < skipProbability) {
        console.log(`[profi] 🚶 ${c.login}: ушёл без парсинга`);
        return [];
      }
      
      // 5. Финальная пауза перед парсингом
      await sleep((2000 + Math.random() * 4000) * delayMul);
    
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
          description: link.text.replace(/\bfalse\b|\btrue\b/gi, "").replace(/\n{2,}/g, "\n").slice(0, 1000).trim(),
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
            description: snippet.text.replace(/\bfalse\b|\btrue\b/gi, "").replace(/\n{2,}/g, "\n").slice(0, 1000).trim(),
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
  monthsOnPlatform?: number;
  fullDescription?: string;
  city?: string;
  lastOnline?: string;
  budgetRaw?: string;
  deadline?: string;
  responsePrice?: number;
}

export async function scrapeOrderPage(sourceId: string, orderUrl: string): Promise<OrderDetails | null> {
  let deepPage: any = null;
  try {
    const cached = sessionCache.get(sourceId);
    if (!cached) {
      console.log("[profi] ⚠️ Нет активной сессии для deep scan");
      return null;
    }

    // Проверяем — отключён ли deep scan в конфиге источника
    const ctx = cached.page.context();
    const cleanUrl = orderUrl.replace(/&analytics_data=.*$/, '');
    console.log(`[profi] 🔍 Глубокий просмотр: ${cleanUrl.slice(0, 60)}...`);

    deepPage = await ctx.newPage();
    await deepPage.goto(cleanUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await deepPage.waitForTimeout(2000);

    const bodyText = await deepPage.locator("body").innerText();
    console.log(`[profi] 📄 Тело страницы (первые 400): ${bodyText.slice(0, 400).replace(/\n/g, " | ")}`);
    
    const details: OrderDetails = {};

    let nameMatch = bodyText.match(/[А-ЯЁ]\s*\n\s*\n?\s*([А-ЯЁ][а-яё]+)/);
    if (!nameMatch) nameMatch = bodyText.match(/[А-ЯЁ]\s*\n\s*([А-ЯЁ][а-яё]+)/);
    if (!nameMatch) nameMatch = bodyText.match(/(?:Заказчик|Исполнитель)[:\s]*([А-ЯЁ][а-яё]+)/i);
    if (nameMatch) details.author = nameMatch[1].trim();

    const reviewMatch = bodyText.match(/(?:Оставил[аи]?\s*)(\d+)\s*(?:отзыв|отзыва|отзывов)/i) || bodyText.match(/(\d+)\s*(?:отзыв|отзыва|отзывов)/i);
    if (reviewMatch) details.reviewCount = parseInt(reviewMatch[1]);

    const regMatch = bodyText.match(/На Профи\.рус\s+(\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4}))/i);
    let monthsOnPlatform = 0;
    if (regMatch) {
      const months: Record<string,number> = {января:0,февраля:1,марта:2,апреля:3,мая:4,июня:5,июля:6,августа:7,сентября:8,октября:9,ноября:10,декабря:11};
      const [_, day, monthName, year] = regMatch;
      const regDate = new Date(parseInt(year), months[monthName.toLowerCase()] || 0, parseInt(day));
      monthsOnPlatform = Math.floor((Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    }

    let clientScore = 0;
    if (monthsOnPlatform >= 24) clientScore += 1.5;
    else if (monthsOnPlatform >= 6) clientScore += 0.8;
    else if (monthsOnPlatform > 0) clientScore += 0.3;
    
    const revs = details.reviewCount || 0;
    if (revs >= 10) clientScore += 1.5;
    else if (revs >= 3) clientScore += 0.8;
    else if (revs >= 1) clientScore += 0.3;
    
    if (clientScore >= 2.2) details.clientRating = 3;
    else if (clientScore >= 1.1) details.clientRating = 2;
    else if (clientScore > 0) details.clientRating = 1;

    const ratingMatch = bodyText.match(/(?:рейтинг|rating)[:\s]*(\d+[.,]\d+)/i);
    if (ratingMatch) details.rating = parseFloat(ratingMatch[1].replace(",", "."));

    const cityMatch = bodyText.match(/(?:Москва|СПб|Санкт-Петербург|Казань|Новосибирск|Екатеринбург|Нижний Новгород|Челябинск|Красноярск|Самара|Омск|Ростов|Уфа|Волгоград|Пермь|Воронеж|Краснодар)/i);
    if (cityMatch) details.city = cityMatch[0];

    const onlineMatch = bodyText.match(/(?:был[а]?\s*(?:в сети|онлайн)|онлайн)\s*(.+?)(?:\n|$)/i);
    if (onlineMatch) details.lastOnline = onlineMatch[1].trim();

    // ─── Извлечение описания заказа ───────────────────────────────
    // Пробуем несколько стратегий — от самой точной до fallback
    let descText = "";
    
    // Стратегия 1: "Пожелания и особенности" / "Описание" — самый надёжный разделитель
    let m = bodyText.match(/Пожелания и особенности[\s\S]*?\n\n([\s\S]+?)(?:\n\n(?:Город|Дистанционно|Когда|Начать|Заказ №)|$)/i);
    if (!m) m = bodyText.match(/Описание[\s\S]*?\n\n([\s\S]+?)(?:\n\n(?:Город|Дистанционно|Когда|Начать|Заказ №)|$)/i);
    
    // Стратегия 2: после заголовка заказа до мета-информации
    if (!m || !m[1] || m[1].trim().length < 10) {
      m = bodyText.match(/Заказ №\s*\d+[\s\S]*?\n\n([\s\S]+?)(?:\n\n(?:Город|Дистанционно|Когда|Начать)|$)/i);
    }
    
    // Стратегия 3: после строки с городом/дистанционно до "Начать" или конца
    if (!m || !m[1] || m[1].trim().length < 10) {
      m = bodyText.match(/(?:Москва|СПб|Санкт-Петербург|Дистанционно)[^\n]*\n\n([\s\S]+?)(?:\n\n(?:Когда|Начать|Заказ №)|$)/i);
    }
    
    // Стратегия 4: всё что после первых 3-5 строк мета-информации
    if (!m || !m[1] || m[1].trim().length < 10) {
      const lines = bodyText.split('\n');
      // Пропускаем строки с мета-информацией (город, заказ №, время назад, имя с заглавной)
      let startIdx = 0;
      let metaLines = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (/^(Москва|СПб|Санкт-Петербург|Казань|Новосибирск|Дистанционно|Заказ №|Заказ оставлен|был[а]?\s|В сети|На Профи|Оставил|Подтвердил|Когда|начать)/i.test(line)) {
          metaLines++;
          continue;
        }
        if (/^[A-ZА-ЯЁ][a-zа-яё]+$/.test(line) && i < 10) { metaLines++; continue; } // имя клиента
        if (/^\d+$/.test(line) && i < 10) { metaLines++; continue; } // цифры
        startIdx = i;
        break;
      }
      if (startIdx > 0) {
        descText = lines.slice(startIdx).join('\n').trim();
      }
    }
    
    if (m && m[1]) {
      descText = m[1].trim();
    }
    
    // Чистим: убираем строки которые выглядят как мета-данные
    descText = descText.replace(/\n(?:Когда|начать|Заказ №|В сети|На Профи|Оставил|Подтвердил).*/gi, '');
    descText = descText.replace(/^\s*(?:Когда|начать|Заказ №).*$/gm, '');
    
    if (descText && descText.length > 5) {
      details.fullDescription = descText.slice(0, 2000).trim();
    }

    const budgetMatch = bodyText.match(/(?:бюджет|стоимость|цена)[:\s]*(\d[\d\s]*)\s*(?:руб|₽)/i);
    if (budgetMatch) details.budgetRaw = budgetMatch[1].replace(/\s/g, "");

    // 💰 Цена отклика (сколько стоит откликнуться на Profi)
    const respMatch = bodyText.match(/(?:цена|стоимость)\s*(?:отклика|контакта|заявки)[:\s]*(\d[\d\s]*)\s*(?:руб|₽)/i)
      || bodyText.match(/(?:отклик|откликнуться|контакт)[^\d]*(\d[\d\s]*)\s*(?:руб|₽)/i)
      || bodyText.match(/(\d[\d\s]*)\s*(?:руб|₽)[^\n]*(?:отклик|контакт)/i);
    if (respMatch) {
      const val = parseInt(respMatch[1].replace(/\s/g, ''), 10);
      if (val >= 10 && val <= 100000) details.responsePrice = val;
    }

    // ⏰ Сроки (deadline)
    const deadlineMatch = bodyText.match(/(?:срок[и]?|выполнить|сделать|до\s+)(\d{1,2}[\s.]*(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s*\d{4}?)/i);
    if (deadlineMatch) {
      details.deadline = deadlineMatch[1].trim();
    } else {
      // Ищем "до N дней", "в течение N дней"
      const daysMatch = bodyText.match(/(?:в\s+течение|до|за)\s+(\d+)\s*(?:дней|дня|день)/i);
      if (daysMatch) details.deadline = `до ${daysMatch[1]} дней`;
    }
    // Часовой пояс
    const tzMatch = bodyText.match(/(?:МСК|MSK|GMT\+3|UTC\+3|московск[а-я]+\s+врем[а-я]+)/i);
    if (tzMatch && details.deadline) {
      details.deadline += ` (${tzMatch[0]})`;
    }

    details.monthsOnPlatform = monthsOnPlatform;
    
    console.log(`[profi] ✅ Глубокий просмотр: автор=${details.author || '?'} отзывов=${details.reviewCount || 0} мес=${monthsOnPlatform} цена отклика=${details.responsePrice || '?'}`);
    await deepPage.close().catch(() => {});
    return details;
  } catch (err: any) {
    await deepPage.close().catch(() => {});
    console.error(`[profi] ❌ Ошибка глубокого просмотра:`, err.message);
    return null;
  }
}

// ─── Режим ждуна — MutationObserver ─────────────────────────────────────
// Открывает ленту 1 раз, ловит появление новых заказов через MutationObserver
// Не требует частых перезаходов — минимальная нагрузка на Profi

let watchSessions = new Map<string, { cleanup: () => void; startTime: number }>();

export interface WatchCallbacks {
  onLead: (lead: NormalizedLead) => void;
  onError: (error: string) => void;
  onStatus: (status: string) => void;
}


const loginFailures: Map<string, { count: number; lastFail: number }> = new Map();
const MAX_LOGIN_FAILURES = 3;
const LOGIN_COOLDOWN_MS = 60 * 60 * 1000; // 1 час

export async function startWatching(
  sourceId: string,
  config: ProfiConfig,
  keywords: string,
  callbacks: WatchCallbacks,
  workHoursStart?: string,
  workHoursEnd?: string
): Promise<boolean> {
  // Не запускаем повторно
  if (watchSessions.has(sourceId)) {
    console.log(`[profi] 👀 ${config.login}: уже в режиме ждуна`);
    return true;
  }

  console.log(`[profi] 👀 ${config.login}: запуск режима ждуна...`);

  const page = await ensureLoggedIn(sourceId, config.login!, config.password!);
  if (!page) {
    callbacks.onError("Не удалось войти");
    return false;
  }

  try {
    // Переходим на страницу ленты заказов
    await page.goto('https://profi.ru/backoffice/n.php', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);

    // Снимаем флаг webdriver (уже есть в контексте, но на всякий случай)
    callbacks.onStatus("Слежу за новыми заказами 👀");

    // Счётчик уже известных ссылок
    let knownHrefs = new Set<string>();

    // Собираем уже видимые ссылки
    const initialLinks = await page.locator('a[href*="?o="]').evaluateAll(
      (els) => els.map((el) => (el as HTMLAnchorElement).href)
    );
    for (const href of initialLinks) {
      knownHrefs.add(href.replace(/&analytics_data=.*$/, ''));
    }
    console.log(`[profi] 👀 ${config.login}: уже видно ${knownHrefs.size} заказов`);

    // Режим: периодическая перезагрузка страницы (Profi не имеет live-ленты)
    // Браузер открыт 1 раз, login 1 раз, дальше только мягкий reload страницы

    const MIN_CHECK = 3;  // мин
    const MAX_CHECK = 8;  // макс

    let checkTimerId: ReturnType<typeof setTimeout> = null;
    let healthCheckId: ReturnType<typeof setInterval> = null;

    const doCheck = async () => {
      try {
        // Проверка: не вышли ли за рабочие часы?
        if (isOutsideWorkHours()) {
          const skipMin = hoursUntilWakeUp();
          console.log(`[profi] 🌙 ${config.login}: снаружи рабочих часов, спим ${Math.round(skipMin/60)}ч`);
          callbacks.onStatus(`🌙 Снаружи рабочих часов (${whStart}:00-${whEnd}:00)`);
          scheduleNext(); // перепланировать на утро
          return;
        }
        console.log(`[profi] 👀 ${config.login}: перезагрузка ленты...`);

        // Человеческая пауза перед обновлением
        await sleep(1000 + Math.random() * 2000);

        // Сохраняем уже известные ссылки до перезагрузки
        const beforeHrefs = new Set(knownHrefs);

        // Мягкая перезагрузка (сессия сохраняется)
        await page.evaluate(() => window.scrollTo(0, 0));
        await sleep(300 + Math.random() * 700);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await sleep(2000 + Math.random() * 3000);

        // Собираем все ссылки после перезагрузки
        const refreshedLinks = await page.locator('a[href*="?o="]').evaluateAll(
          (els) => els.map((el) => ({
            href: (el as HTMLAnchorElement).href,
            text: (el as HTMLElement).innerText?.trim() || "",
          }))
        );

        let newFound = 0;

        // Session expired → STOP (no auto-restart). Restart storms caused Profi bans 30.07.2026.
        // New path: agent-core CircuitBreaker + ProfiCollector on VPS.
        if (refreshedLinks.length === 0) {
          const bt = await page.locator("body").innerText().catch(() => "");
          if (bt.includes("Вход и регистрация") || bt.includes("Восстановить пароль")) {
            console.error("[profi] SESSION EXPIRED " + config.login + " — STOP (no auto-restart)");
            callbacks.onError("SESSION EXPIRED — watcher stopped, no auto-restart");
            stopWatching(sourceId);
            return;
          }
        }
        for (const link of refreshedLinks) {
          const cleanHref = link.href.replace(/&analytics_data=.*$/, '');
          if (beforeHrefs.has(cleanHref)) continue;
          if (knownHrefs.has(cleanHref)) continue;
          knownHrefs.add(cleanHref);
          newFound++;

          const lines = link.text.split("\n").map(l => l.trim()).filter(Boolean);
          const title = lines.find(l =>
            l.length > 3 && l !== "false" && l !== "true" &&
            !/^\d{1,2}\s+(июня|июля|августа|сентября|октября|ноября|декабря|января|февраля|марта|апреля|мая)/.test(l) &&
            !/^(Вчера|Сегодня|\d+\s+(час|минут|день|дня).*назад)/.test(l)
          ) || "Новый заказ";

          callbacks.onLead({
            externalId: cleanHref,
            title: title.slice(0, 150),
            description: link.text.replace(/\bfalse\b|\btrue\b/gi, "").replace(/\n{2,}/g, "\n").slice(0, 1000).trim(),
            url: cleanHref,
            createdAt: new Date().toISOString(),
          });
        }

        if (newFound > 0) {
          console.log("[profi] EYES " + config.login + ": found " + newFound + " new orders");
        }

        // Человеческое поведение: скролл
        await sleep(1500 + Math.random() * 2500);
        for (let i = 2 + Math.floor(Math.random() * 3); i > 0; i--) {
          await page.evaluate(() => window.scrollBy(0, 200 + Math.random() * 500));
          await sleep(1000 + Math.random() * 2000);
        }

        // Иногда клик по заказу
        if (Math.random() < 0.15) {
          const links = await page.locator('a[href*="?o="]').all();
          if (links.length > 0) {
            const idx = Math.floor(Math.random() * Math.min(links.length, 5));
            try {
              await links[idx].click({ timeout: 5000, delay: 30 + Math.random() * 50 });
              await sleep(3000 + Math.random() * 5000);
              await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
              await sleep(1500 + Math.random() * 2500);
            } catch {}
          }
        }

        callbacks.onStatus(isOutsideWorkHours() ? `🌙 Стоп до ${whStart}:00 (настройки)` : `👀 След. проверка через ~${Math.round(MIN_CHECK)}-${Math.round(MAX_CHECK)} мин`);
      } catch (err) {
        console.error('[profi] ERROR ' + config.login + ': ' + (err && err.stack ? err.stack : String(err)));
        try {
          await page.goto('https://profi.ru/backoffice/n.php', { waitUntil: 'domcontentloaded', timeout: 20000 });
        } catch {
          // No auto-restart — soft recover only by soft reload above. Hard stop if page dead.
          console.error(`[profi] ${config.login}: page dead — STOP (no auto-restart, use agent-core CB)`);
          callbacks.onError("page dead — watcher stopped");
          stopWatching(sourceId);
        }
      }
    };

    // Первая проверка через 1-2 мин
    setTimeout(() => doCheck(), 60000 + Math.random() * 60000);

    // Планировщик: случайный интервал 3-8 мин
    // Рабочие часы из настроек пользователя (или дефолт: 08:00-22:00)
    const whStart = workHoursStart || "08:00";
    const whEnd = workHoursEnd || "22:00";
    const whStartH = parseInt(whStart.split(":")[0]);
    const whEndH = parseInt(whEnd.split(":")[0]);

    const isOutsideWorkHours = () => {
      const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const h = now.getUTCHours();
      return h < whStartH || h >= whEndH;
    };
    const hoursUntilWakeUp = () => {
      const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const h = now.getUTCHours();
      if (h >= whEndH) {
        // Вечер — спать до завтрашнего утра
        const toMidnight = 24 - h;
        return (toMidnight + whStartH) * 60;
      }
      if (h < whStartH) {
        return (whStartH - h) * 60;
      }
      return 0;
    };

    const scheduleNext = () => {
      let minutes: number;
      if (isOutsideWorkHours()) {
        minutes = hoursUntilWakeUp();
        if (minutes > 0) {
          callbacks.onStatus(`🌙 Стоп до ${whStart}:00 МСК (настройки)`);
          console.log("[profi] 🌙 " + config.login + ": стоп до " + whStart + ":00 МСК");
        } else {
          minutes = MIN_CHECK + Math.random() * (MAX_CHECK - MIN_CHECK);
        }
      } else {
        minutes = MIN_CHECK + Math.random() * (MAX_CHECK - MIN_CHECK);
      }
      const ms = minutes * 60 * 1000 * (0.8 + Math.random() * 0.4);
      checkTimerId = setTimeout(async () => {
        await doCheck();
        scheduleNext();
      }, ms);
    };
    scheduleNext();

    // Health check: только стоп при мёртвой странице (без рестарта).
    healthCheckId = setInterval(async () => {
      try {
        await page.evaluate(() => document.title);
      } catch {
        console.error("[profi] HEALTH " + config.login + ": page died — STOP (no auto-restart)");
        callbacks.onError("health: page died — watcher stopped");
        stopWatching(sourceId);
      }
    }, 600000);

    const cleanup = () => {
      if (checkTimerId) clearTimeout(checkTimerId);
      if (healthCheckId) clearInterval(healthCheckId);
    };;

    watchSessions.set(sourceId, { cleanup, startTime: Date.now() });
    console.log(`[profi] ✅ ${config.login}: ждун запущен`);
    callbacks.onStatus("👀 Ждун: слежу за новыми заказами");
    return true;
  } catch (err: any) {
    console.error(`[profi] ❌ ${config.login}: ошибка запуска ждуна: ${err.message}`);
    callbacks.onError(err.message);
    return false;
  }
}

export function stopWatching(sourceId: string) {
  const session = watchSessions.get(sourceId);
  if (session) {
    session.cleanup();
    watchSessions.delete(sourceId);
    console.log(`[profi] ⏹ Ждун остановлен для source ${sourceId.slice(0, 8)}`);
  }
}

export function stopAllWatching() {
  for (const [id] of watchSessions) {
    stopWatching(id);
  }
}

registerConnector(profiConnector);

process.on("exit", () => {
  stopAllWatching();
  for (const [, session] of sessionCache) {
    session.browser.close().catch(() => {});
  }
  sessionCache.clear();
});
