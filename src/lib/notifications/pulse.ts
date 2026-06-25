// 📨 Pulse — умные оповещения в Telegram
// Утренний привет, пульс каждые 2ч, вечерний отчёт, старт/стоп
// Интегрируется в worker.ts

import { db } from "@/lib/db";

const lastSent: Record<string, number> = {};

function shouldSend(key: string, cooldownMs: number): boolean {
  const now = Date.now();
  if (!lastSent[key] || now - lastSent[key] > cooldownMs) {
    lastSent[key] = now;
    return true;
  }
  return false;
}

function mskHour(): number {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).getUTCHours();
}
function mskTime(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}
function mskDate(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

async function sendToAdmin(botToken: string, chatId: string, text: string) {
  if (!botToken || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000),
    });
    console.log("[pulse] 📨 Отправлено админу");
  } catch (e) {
    console.error("[pulse] ❌ Ошибка отправки:", e);
  }
}

async function sendToPartner(botToken: string, chatId: string, text: string) {
  if (!botToken || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {}
}

interface PulseStats {
  total: number; today: number; sinceLastPulse: number; priority: number; human: number;
  sources: { login: string; status: string; mode: string }[];
  workspaces: { name: string; email: string; today: number; total: number; lastMin: number | null }[];
}

async function getStats(): Promise<PulseStats> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const totalLeads = await db.lead.count();
  const workspaces = await db.workspace.findMany({
    include: {
      user: { select: { email: true } },
      _count: { select: { leads: true } },
      sources: { select: { config: true, status: true, enabled: true } },
      settings: { select: { telegramChatId: true, telegramToken: true, systemEnabled: true } },
    },
  });

  let todayTotal = 0, priorityTotal = 0, humanTotal = 0;
  const wsStats: PulseStats["workspaces"] = [];
  const srcStats: PulseStats["sources"] = [];

  for (const ws of workspaces) {
    const wsToday = await db.lead.count({ where: { workspaceId: ws.id, createdAt: { gte: today } } });
    todayTotal += wsToday;
    const wsPriority = await db.leadAnalysis.count({ where: { lead: { workspaceId: ws.id }, score: { gte: 70 } } });
    priorityTotal += wsPriority;
    const wsHuman = await db.leadAnalysis.count({ where: { lead: { workspaceId: ws.id }, botProbability: { lte: 30 } } });
    humanTotal += wsHuman;
    const last = await db.lead.findFirst({ where: { workspaceId: ws.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    wsStats.push({ name: ws.name, email: ws.user?.email || "?", today: wsToday, total: ws._count.leads, lastMin: last ? Math.floor((Date.now() - new Date(last.createdAt).getTime()) / 60000) : null });
    for (const src of ws.sources) {
      const login = (src.config as any)?.login || "?";
      const ad = (src.config as any)?.antiDetect || {};
      srcStats.push({ login, status: src.enabled ? (src.status === "error" ? "🔴" : "🟢") : "⏸", mode: ad.mode || (src.enabled ? "watch" : "off") });
    }
  }

  const lastPulseTime = lastSent["pulse_2h"] || Date.now() - 2 * 60 * 60 * 1000;
  const sinceLastPulse = await db.lead.count({ where: { createdAt: { gte: new Date(lastPulseTime) } } });
  return { total: totalLeads, today: todayTotal, sinceLastPulse, priority: priorityTotal, human: humanTotal, sources: srcStats, workspaces: wsStats };
}

function fmtSources(sources: PulseStats["sources"]): string {
  if (sources.length === 0) return "   · нет источников";
  return sources.map(s => `   ${s.status} ${s.login} (${s.mode === "stealth" ? "🕵️" : s.mode === "watch" || !s.mode ? "👀" : "⚔️"})`).join("\n");
}

function fmtWorkspaces(wsStats: PulseStats["workspaces"]): string {
  return wsStats.map(ws => {
    const emailShort = ws.email.split("@")[0];
    const status = ws.lastMin !== null && ws.lastMin < 120 ? "🟢" : ws.lastMin !== null && ws.lastMin < 300 ? "🟡" : "🔴";
    return `   ${status} ${emailShort}: ${ws.today} сегодня / ${ws.total} всего${ws.lastMin !== null ? ` (${ws.lastMin} мин)` : ""}`;
  }).join("\n");
}

export async function pulseCheck(botToken: string, adminChatId: string) {
  const hour = mskHour();

  if (hour === 7 && shouldSend("morning", 25 * 60 * 1000)) {
    const stats = await getStats();
    const msg = `☀️ *Доброе утро! ${mskDate()}, ${mskTime()} МСК*\n\n📥 *Вчера:* ${stats.today} заявок (⭐ ${stats.priority} приоритетных, 🟢 ${stats.human} от людей)\n\n🔌 *Источники:*\n${fmtSources(stats.sources)}\n\n👀 *Ждун запущен:* проверка каждые 3-8 мин\n🌙 *Ночной стоп был:* 00:00-07:00\n\nХорошего дня! 🚀`;
    await sendToAdmin(botToken, adminChatId, msg);
    // Утро партнёрам
    for (const ws of stats.workspaces) {
      const wss = await db.workspace.findFirst({ where: { name: ws.name }, include: { settings: true } });
      if (wss?.settings?.telegramChatId && wss?.settings?.telegramToken) {
        await sendToPartner(wss.settings.telegramToken, wss.settings.telegramChatId, `☀️ *Доброе утро! ${mskDate()}*\n\n📥 Вчера собрано: ${ws.today} заявок\n\nХорошего дня! 🚀`);
      }
    }
  }

  if (hour >= 8 && hour <= 20 && hour % 2 === 0 && shouldSend("pulse_2h", 110 * 60 * 1000)) {
    const stats = await getStats();
    const msg = `💚 *Пульс ${mskTime()} МСК*\n\n📥 Сегодня: *${stats.today}* заявок (+${stats.sinceLastPulse} новых)\n\n🔌 *Источники:*\n${fmtSources(stats.sources)}\n\n📊 *Партнёры:*\n${fmtWorkspaces(stats.workspaces)}\n\n⏱ След. проверка ждуна через ~3-8 мин`;
    await sendToAdmin(botToken, adminChatId, msg);
  }

  if (hour === 22 && shouldSend("evening", 25 * 60 * 1000)) {
    const stats = await getStats();
    const msg = `🌙 *Вечер. Итоги ${mskDate()}*\n\n📊 *За сегодня:* ${stats.today} заявок\n⭐ Приоритетных (70+): ${stats.priority}\n🟢 От людей (не боты): ${stats.human}\n\n📊 *Партнёры:*\n${fmtWorkspaces(stats.workspaces)}\n\n🔌 *Источники:*\n${fmtSources(stats.sources)}\n\n🕐 Ухожу на покой до 07:00 МСК\nСпокойной ночи! 😴`;
    await sendToAdmin(botToken, adminChatId, msg);
    for (const ws of stats.workspaces) {
      const wss = await db.workspace.findFirst({ where: { name: ws.name }, include: { settings: true } });
      if (wss?.settings?.telegramChatId && wss?.settings?.telegramToken) {
        await sendToPartner(wss.settings.telegramToken, wss.settings.telegramChatId, `🌙 *Итоги ${mskDate()}*\n\n📊 За сегодня: ${ws.today} заявок\n📦 Всего: ${ws.total}\n\nСпокойной ночи! 😴`);
      }
    }
  }
}

export async function notifyStart(botToken: string, adminChatId: string) {
  if (!botToken || !adminChatId) return;
  await sendToAdmin(botToken, adminChatId, `🚀 *Система Leads AI запущена* ${mskTime()} МСК\n\n👀 *Режим:* Ждун (проверка 3-8 мин)\n🌙 *Ночной стоп:* 00:00-07:00 МСК\n💚 *Пульс:* каждые 2 часа\n\nПервый отчёт через пару часов или после первых заявок!`);
}

export async function notifyStop(botToken: string, adminChatId: string) {
  if (!botToken || !adminChatId) return;
  const stats = await getStats();
  await sendToAdmin(botToken, adminChatId, `⏸ *Система остановлена* ${mskTime()} МСК\n\n📊 Сегодня собрано: ${stats.today} заявок\n\nДля запуска: настройки → включить систему.`);
}

export async function notifyWatcherSilent(botToken: string, adminChatId: string, login: string, silentMinutes: number) {
  if (!botToken || !adminChatId) return;
  const key = `silent_${login}`;
  if (!shouldSend(key, 30 * 60 * 1000)) return;
  await sendToAdmin(botToken, adminChatId, `🔴 *Ждун ${login} молчит > ${silentMinutes} мин*\n\n🔄 Включаю резервный циклический сбор.\nПроверьте сессию Profi для этого аккаунта.`);
}
