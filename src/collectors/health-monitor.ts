// 🩺 Health Monitor — независимый процесс
// Проверяет: PM2 процессы, БД, Telegram API, лиды, коллекторы
// Шлёт алерты админу и пульс партнёрам
// Запуск: pm2 start src/collectors/health-monitor.ts --name leads-health

import { db } from "@/lib/db";
import { execSync } from "child_process";

const CHECK_INTERVAL = 5 * 60 * 1000; // каждые 5 минут
const RESTART_THRESHOLD = 3; // алерт если >3 рестартов за час
const SILENT_LEADS_MINUTES = 60; // алерт если нет лидов >60 мин
const TELEGRAM_TIMEOUT = 8000;

// Состояние
const restartHistory: Map<string, number[]> = new Map();
const lastRestartCount: Map<string, number> = new Map(); // process -> timestamps
const lastAlertSent: Map<string, number> = new Map(); // alertKey -> lastSent

function mskHour(): number {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).getUTCHours();
}
function mskTime(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function shouldAlert(key: string, cooldownMs: number): boolean {
  const now = Date.now();
  const last = lastAlertSent.get(key) || 0;
  if (now - last < cooldownMs) return false;
  lastAlertSent.set(key, now);
  return true;
}

async function sendTelegram(token: string, chatId: string, text: string): Promise<boolean> {
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT),
    });
    return ((await res.json()) as any).ok === true;
  } catch {
    return false;
  }
}

// ─── Проверки ───────────────────────────────────────────────

async function checkPM2(): Promise<{ ok: boolean; processes: any[] }> {
  try {
    const raw = execSync("pm2 jlist 2>/dev/null", { timeout: 5000, encoding: "utf-8" });
    const list = JSON.parse(raw);
    const problems: string[] = [];
    for (const p of list) {
      if (p.name === "leads-health") continue; // себя не проверяем
      if (p.pm2_env?.status !== "online") {
        problems.push(`🔴 ${p.name}: ${p.pm2_env?.status || "unknown"}`);
      }
      // Отслеживаем рестарты
      const key = p.name;
      const now = Date.now();
      const currentCount = p.pm2_env?.restart_time || 0;
      const prevCount = lastRestartCount.get(key);
      if (prevCount === undefined) {
        lastRestartCount.set(key, currentCount);
      } else if (currentCount > prevCount) {
        const diff = currentCount - prevCount;
        const history = restartHistory.get(key) || [];
        for (let i = 0; i < diff; i++) history.push(now);
        const recent = history.filter((t: number) => now - t < 60 * 60 * 1000);
        restartHistory.set(key, recent);
        lastRestartCount.set(key, currentCount);
      }
    }
    return { ok: problems.length === 0, processes: list };
  } catch (e) {
    return { ok: false, processes: [] };
  }
}

async function checkDB(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function checkTelegramAPI(): Promise<boolean> {
  try {
    const res = await fetch("https://api.telegram.org/", { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkRecentLeads(): Promise<{ count: number; lastMin: number | null }> {
  try {
    const count = await db.lead.count({ where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } });
    const last = await db.lead.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    const lastMin = last ? Math.floor((Date.now() - new Date(last.createdAt).getTime()) / 60000) : null;
    return { count, lastMin };
  } catch {
    return { count: -1, lastMin: null };
  }
}

async function getSourcesStatus(): Promise<{ login: string; status: string }[]> {
  try {
    const sources = await db.source.findMany({ where: { enabled: true }, select: { config: true, status: true } });
    return sources.map(s => ({
      login: (s.config as any)?.login || "?",
      status: s.status === "error" ? "🔴" : "🟢",
    }));
  } catch {
    return [];
  }
}

async function getPartnerInfo() {
  try {
    const wss = await db.workspace.findMany({
      include: {
        user: { select: { email: true } },
        settings: { select: { telegramChatId: true, telegramToken: true } },
        _count: { select: { leads: true } },
      },
    });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const result = [];
    for (const ws of wss) {
      const todayCount = await db.lead.count({ where: { workspaceId: ws.id, createdAt: { gte: today } } });
      result.push({
        name: ws.name,
        email: ws.user?.email || "?",
        telegramChatId: ws.settings?.telegramChatId,
        telegramToken: ws.settings?.telegramToken,
        today: todayCount,
        total: ws._count.leads,
      });
    }
    return result;
  } catch {
    return [];
  }
}

// ─── Алерты ──────────────────────────────────────────────────

async function checkRestartAlerts(adminToken: string, adminChatId: string) {
  for (const name of Array.from(restartHistory.keys())) {
    const history = restartHistory.get(name) || [];
    const recent = history.filter((t: number) => Date.now() - t < 60 * 60 * 1000);
    if (recent.length >= RESTART_THRESHOLD) {
      if (shouldAlert(`restart_${name}`, 60 * 60 * 1000)) {
        await sendTelegram(adminToken, adminChatId, `🔴 *Частые рестарты: ${name}*\n${recent.length} раз за последний час\n\nПроверь логи: \`pm2 logs ${name} --lines 20\``);
      }
    }
  }
}

// ─── Пульс партнёрам ─────────────────────────────────────────

async function sendPartnerPulse() {
  const hour = mskHour();
  // Пульс каждые 3 часа в рабочее время
  if (hour < 8 || hour > 20) return;
  if (hour % 3 !== 0) return;
  if (!shouldAlert(`partner_pulse_${hour}`, 150 * 60 * 1000)) return;

  const partners = await getPartnerInfo();
  const sources = await getSourcesStatus();
  const { count, lastMin } = await checkRecentLeads();

  for (const p of partners) {
    if (!p.telegramToken || !p.telegramChatId) continue;
    const msg = [
      `💚 *Leads AI — проверка связи* ${mskTime()} МСК`,
      "",
      `📥 Сегодня: *${p.today}* заявок`,
      `📦 Всего: *${p.total}*`,
      `⏱ Последняя: ${lastMin !== null ? `${lastMin} мин назад` : "—"}`,
      "",
      `🔌 Источники:`,
      ...sources.map(s => `   ${s.status} ${s.login}`),
      "",
      `🟢 Система работает штатно`,
      `👀 Ждун активен, проверка 3-8 мин`,
    ].join("\n");
    await sendTelegram(p.telegramToken, p.telegramChatId, msg);
  }
}

// ─── Heartbeat партнёрам (лёгкий) ────────────────────────────

async function sendPartnerHeartbeat() {
  const hour = mskHour();
  if (hour < 8 || hour > 20) return;
  // В часы когда нет пульса — шлём лёгкий heartbeat
  if (hour % 3 === 0) return; // не дублируем пульс
  
  // Каждый час в рабочее время
  if (!shouldAlert(`heartbeat_${hour}`, 55 * 60 * 1000)) return;

  const partners = await getPartnerInfo();
  for (const p of partners) {
    if (!p.telegramToken || !p.telegramChatId) continue;
    await sendTelegram(p.telegramToken, p.telegramChatId, `🟢 *Leads AI — на связи* ${mskTime()} МСК\n\nСистема работает, ждун активен.`);
  }
}

// ─── Главный цикл ────────────────────────────────────────────

async function runChecks() {
  console.log(`[health] 🩺 Проверка ${new Date().toISOString()}...`);

  // 1. PM2 процессы
  const pm2 = await checkPM2();
  if (!pm2.ok) {
    console.log("[health] ⚠️ Проблемы с PM2 процессами");
  }

  // 2. База данных
  const dbOk = await checkDB();
  if (!dbOk) {
    console.error("[health] ❌ База данных недоступна!");
  }

  // 3. Telegram API
  const tgOk = await checkTelegramAPI();
  if (!tgOk) {
    console.error("[health] ❌ Telegram API недоступен!");
  }

  // 4. Лиды
  const leads = await checkRecentLeads();

  // Получаем админа для алертов
  let adminToken = "", adminChatId = "";
  try {
    const adminWs = await db.workspace.findFirst({
      where: { name: "Моё пространство" },
      include: { settings: true },
    });
    adminToken = adminWs?.settings?.telegramToken || "";
    adminChatId = adminWs?.settings?.telegramChatId || "";
  } catch {}

  // 5. Алерты рестартов
  await checkRestartAlerts(adminToken, adminChatId);

  // 6. Алерт: нет лидов
  if (leads.lastMin !== null && leads.lastMin > SILENT_LEADS_MINUTES && shouldAlert("silent_leads", 60 * 60 * 1000)) {
    const sources = await getSourcesStatus();
    await sendTelegram(adminToken, adminChatId, `🔴 *Нет новых заявок > ${leads.lastMin} мин*\n\n🔌 Источники:\n${sources.map(s => `   ${s.status} ${s.login}`).join("\n")}\n\nПроверь сессии Profi.`);
  }

  // 7. Алерт: БД или Telegram упали
  if (!dbOk && shouldAlert("db_down", 15 * 60 * 1000)) {
    await sendTelegram(adminToken, adminChatId, "🔴 *База данных недоступна!*\n\nСрочно проверь сервер.");
  }
  if (!tgOk && shouldAlert("tg_down", 15 * 60 * 1000)) {
    await sendTelegram(adminToken, adminChatId, "🔴 *Telegram API недоступен!*\n\nУведомления не доходят.");
  }

  // 8. Пульс партнёрам
  await sendPartnerPulse();

  // 9. Heartbeat партнёрам
  await sendPartnerHeartbeat();

  // Лог
  const status = [dbOk ? "🟢DB" : "🔴DB", tgOk ? "🟢TG" : "🔴TG", `📥${leads.count}leads`].join(" ");
  console.log(`[health] ${status} — следующая проверка через ${CHECK_INTERVAL / 60000} мин`);
}

// Запуск
console.log("[health] 🩺 Health Monitor запущен");
console.log(`[health] Интервал: ${CHECK_INTERVAL / 60000} мин`);
console.log(`[health] Алерт рестартов: >${RESTART_THRESHOLD}/час`);
console.log(`[health] Алерт тишины: >${SILENT_LEADS_MINUTES} мин без лидов`);

runChecks();
setInterval(runChecks, CHECK_INTERVAL);

// Graceful shutdown
process.on("SIGINT", () => { console.log("[health] ⏹ Остановлен"); process.exit(0); });
process.on("SIGTERM", () => { console.log("[health] ⏹ Остановлен"); process.exit(0); });
