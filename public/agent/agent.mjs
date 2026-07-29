#!/usr/bin/env node
// leads-agent — скрипт для VPS партнёра
// Запуск: node agent.mjs (или через PM2: pm2 start agent.mjs --name leads-agent)
// Требования: Node.js 20+, Playwright (npx playwright install chromium)

const API = process.env.API_URL || "https://leads.konversus.ru";
const SECRET = process.env.AGENT_SECRET || "leads-agent-secret-2026";
const SOURCE_ID = process.env.SOURCE_ID || ""; // ID источника в БД

if (!SOURCE_ID) { console.error("❌ SOURCE_ID не задан!"); process.exit(1); }

console.log("[agent] 🚀 Запуск агента");
console.log("[agent] API:", API);
console.log("[agent] Source:", SOURCE_ID);

let totalLeads = 0, totalErrors = 0, startTime = Date.now();

// ─── HTTP-хелперы ─────────────────────────────────

async function api(path: string, body?: any): Promise<any> {
  const url = `${API}/api/agent/${path}`;
  const opts: any = { headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000) };
  if (body) { opts.method = "POST"; opts.body = JSON.stringify(body); }
  try {
    const res = await fetch(url, opts);
    return await res.json();
  } catch (e: any) {
    console.error("[agent] API error:", e.message);
    return null;
  }
}

// ─── Heartbeat ─────────────────────────────────────

async function heartbeat() {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const mem = Math.floor(process.memoryUsage().heapUsed / 1024 / 1024);
  await api("heartbeat", {
    secret: SECRET, sourceId: SOURCE_ID,
    status: { leads: totalLeads, errors: totalErrors, uptime, memory: mem },
  });
}

// ─── Загрузка конфига ──────────────────────────────

async function loadConfig() {
  const res = await fetch(`${API}/api/agent/config?secret=${SECRET}&sourceId=${SOURCE_ID}`);
  if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);
  const cfg = await res.json();
  if (cfg.error) throw new Error(cfg.error);
  return cfg;
}

// ─── Profi-парсер ──────────────────────────────────

async function startProfiWatcher(config: any) {
  const { chromium } = await import("playwright");

  const LOGIN_URL = "https://profi.ru/backoffice/n.php";
  let knownHrefs = new Set<string>();
  let browser: any, page: any;

  async function ensureLoggedIn(): Promise<boolean> {
    if (browser) {
      try {
        await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
        const body = await page.locator("body").innerText();
        if (!body.includes("Вход и регистрация")) return true;
      } catch { /* session expired */ }
      await browser.close().catch(() => {});
    }

    console.log("[agent] 🔑 Вход:", config.login);
    browser = await chromium.launch({ headless: true });

    const ad = config.antiDetect || {};
    const context = await browser.newContext({
      viewport: { width: 1280 + Math.floor(Math.random() * 400), height: 800 + Math.floor(Math.random() * 200) },
      userAgent: ad.mode === "stealth"
        ? "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      locale: "ru-RU",
      timezoneId: "Europe/Moscow",
    });

    page = await context.newPage();
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

    try {
      await page.waitForSelector('[data-testid="auth_login_input"]', { timeout: 10000 });
      await page.fill('[data-testid="auth_login_input"]', config.login);
      await page.fill('input[type="password"]', config.password);
      await page.click('[data-testid="enter_with_sms_btn"]');
      await page.waitForTimeout(5000);

      const bodyText = await page.locator("body").innerText();
      if (bodyText.includes("Некорректный логин") || bodyText.includes("Некорректный пароль")) {
        console.error("[agent] ❌ Неверный логин/пароль");
        return false;
      }
      if (bodyText.includes("Вход и регистрация")) {
        console.error("[agent] ❌ Не удалось войти (возможно SMS/капча)");
        return false;
      }
      console.log("[agent] ✅ Вход выполнен");
      return true;
    } catch (e: any) {
      console.error("[agent] ❌ Ошибка входа:", e.message);
      return false;
    }
  }

  async function checkLeads() {
    try {
      if (!(await ensureLoggedIn())) return;
      await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(2000 + Math.random() * 3000);

      const links = await page.locator('a[href*="?o="]').evaluateAll(
        (els: any[]) => els.map(el => ({
          href: (el as HTMLAnchorElement).href.replace(/&analytics_data=.*$/, ""),
          text: (el as HTMLElement).innerText?.trim() || "",
        }))
      );

      let newFound = 0;
      for (const link of links) {
        if (knownHrefs.has(link.href)) continue;
        knownHrefs.add(link.href);
        newFound++;

        const lines = link.text.split("\n").map((l: string) => l.trim()).filter(Boolean);
        const title = lines.find((l: string) => l.length > 3 && !l.startsWith("false") && !l.startsWith("true") && !/^\d{1,2}\s+(июня|июля)/.test(l) && !/^(Вчера|Сегодня|\d+\s+(час|минут))/.test(l)) || "Заказ";

        await api("leads", {
          secret: SECRET, sourceId: SOURCE_ID,
          leads: [{
            externalId: link.href,
            title: title.slice(0, 150),
            description: link.text.replace(/\bfalse\b|\btrue\b/gi, "").replace(/\n{2,}/g, "\n").slice(0, 1000).trim(),
            url: link.href,
            createdAt: new Date().toISOString(),
          }],
        });

        totalLeads++;
        console.log("[agent] 📥 Новый заказ:", title.slice(0, 50));
        await new Promise(r => setTimeout(r, 300 + Math.random() * 700));
      }

      if (newFound > 0) console.log(`[agent] Найдено ${newFound} новых`);
    } catch (e: any) {
      totalErrors++;
      console.error("[agent] Ошибка:", e.message);
    }
  }

  // Первый сбор
  await checkLeads();

  // Цикл: случайный интервал 2-6 мин
  const schedule = () => {
    const min = 2 + Math.random() * 4;
    setTimeout(async () => {
      await checkLeads();
      schedule();
    }, min * 60000);
  };
  schedule();
}

// ─── Главный цикл ──────────────────────────────────

async function main() {
  console.log("[agent] 📡 Загрузка конфига...");
  const config = await loadConfig();
  console.log("[agent] ✅ Конфиг получен:", config.login);

  // Heartbeat каждые 5 мин
  setInterval(heartbeat, 5 * 60 * 1000);
  await heartbeat();

  // Запуск Profi-наблюдателя
  await startProfiWatcher(config);
}

main().catch(e => { console.error("[agent] ❌", e.message); process.exit(1); });

process.on("SIGINT", () => { console.log("[agent] ⏹ Остановлен"); process.exit(0); });
process.on("SIGTERM", () => { console.log("[agent] ⏹ Остановлен"); process.exit(0); });
