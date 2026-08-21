/**
 * Health Monitor v5 — ops для админа (флот VPS-агентов).
 *
 * Profi на хабе ВЫКЛЮЧЕН (profiOnHub: false).
 * Партнёрам не пишем. Админу: тревоги сразу + 1 сводка вечером (~21:00 МСК).
 */
import { db } from "@/lib/db";
import { HUB_COLLECTOR_POLICY } from "@/config/hub";
import { patchSourceAgentMeta } from "@/lib/agent/source-config";
import { isActiveAgentError } from "@/lib/agent/stale-error";
import { diagnose, healSafe } from "@/lib/admin/doctor";
import { loadHubEnv, resolveServiceBotToken } from "@/lib/telegram/bot-token";
import {
  TELEGRAM_ATTEMPT_ACTIVITY,
  TELEGRAM_DELIVERY_ACTIVITY,
} from "@/lib/telegram/delivery";

loadHubEnv();

const CHECK_MINUTES = 5;
const CHECK_MS = CHECK_MINUTES * 60 * 1000;
const OFFLINE_MS = 15 * 60 * 1000;

/** Включить только явно: HEALTH_LEGACY_PULSE=1 (старый спам партнёрам). */
const LEGACY_PULSE = process.env.HEALTH_LEGACY_PULSE === "1";

const ADMIN_CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID || "778784292";

type AlertKey = string;
const lastAlert: Record<AlertKey, number> = {};
let notificationFailures = 0;

function cooldown(key: AlertKey, ms: number): boolean {
  const now = Date.now();
  if (lastAlert[key] && now - lastAlert[key] < ms) return false;
  lastAlert[key] = now;
  return true;
}

function mskHour() {
  return new Date(Date.now() + 3 * 3600 * 1000).getUTCHours();
}
function mskTime() {
  return new Date(Date.now() + 3 * 3600 * 1000).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function tg(token: string, chat: string, text: string): Promise<boolean> {
  if (!token || !chat) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: "Markdown" }),
      signal: AbortSignal.timeout(8000),
    });
    return ((await res.json()) as { ok?: boolean }).ok === true;
  } catch {
    return false;
  }
}

async function dbOk() {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function tgOk() {
  try {
    return (await fetch("https://api.telegram.org/", { signal: AbortSignal.timeout(5000) })).ok;
  } catch {
    return false;
  }
}

async function leadsInfo() {
  try {
    const cnt = await db.lead.count({ where: { createdAt: { gte: new Date(Date.now() - 3600 * 1000) } } });
    const last = await db.lead.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    return { count: cnt, lastMin: last ? Math.floor((Date.now() - new Date(last.createdAt).getTime()) / 60000) : null };
  } catch {
    return { count: -1, lastMin: null };
  }
}

async function adminChannel() {
  const { token } = await resolveServiceBotToken();
  return { token, chat: ADMIN_CHAT };
}

async function getPartnersLegacy() {
  try {
    const wss = await db.workspace.findMany({
      where: { user: { role: "user" } },
      include: {
        user: { select: { email: true } },
        settings: { select: { telegramChatId: true, telegramToken: true } },
        _count: { select: { leads: true } },
      },
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const res = [];
    for (const w of wss) {
      const t = await db.lead.count({ where: { workspaceId: w.id, createdAt: { gte: today } } });
      res.push({
        name: w.name,
        email: w.user?.email || "?",
        chat: w.settings?.telegramChatId,
        token: w.settings?.telegramToken,
        today: t,
        total: w._count.leads,
      });
    }
    return res;
  } catch {
    return [];
  }
}

type FleetRow = {
  email: string;
  login: string;
  sourceId: string;
  enabled: boolean;
  online: boolean;
  hbAgeMin: number | null;
  cb: string;
  lastError: string | null;
  leadsToday: number;
  telegramAttemptedToday: number;
  telegramDeliveredToday: number;
};

async function fleetSnapshot(): Promise<FleetRow[]> {
  const sources = await db.source.findMany({
    where: { platform: "profi", workspace: { user: { role: "user" } } },
    include: { workspace: { include: { user: { select: { email: true, role: true } } } } },
  });
  const todayMsk = new Date(Date.now() + 3 * 3600 * 1000);
  todayMsk.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date(todayMsk.getTime() - 3 * 3600 * 1000);
  const todayCounts = await db.lead.groupBy({
    by: ["workspaceId"],
    where: { createdAt: { gte: todayStart } },
    _count: { _all: true },
  });
  const todayMap = new Map(todayCounts.map((c) => [c.workspaceId, c._count._all]));
  const tgCounts = await db.activityLog.groupBy({
    by: ["workspaceId", "type"],
    where: {
      type: { in: [TELEGRAM_ATTEMPT_ACTIVITY, TELEGRAM_DELIVERY_ACTIVITY] },
      createdAt: { gte: todayStart },
    },
    _count: { _all: true },
  });
  const tgDeliveredMap = new Map(
    tgCounts
      .filter((c) => c.type === TELEGRAM_DELIVERY_ACTIVITY)
      .map((c) => [c.workspaceId, c._count._all]),
  );
  const tgAttemptedMap = new Map(
    tgCounts
      .filter((c) => c.type === TELEGRAM_ATTEMPT_ACTIVITY)
      .map((c) => [c.workspaceId, c._count._all]),
  );

  return sources.map((s) => {
    const cfg = (s.config as Record<string, unknown>) || {};
    const hb = cfg._lastHeartbeat ? new Date(String(cfg._lastHeartbeat)).getTime() : null;
    const age = hb ? Date.now() - hb : null;
    const cb = (cfg._circuitBreaker as { state?: string } | undefined)?.state || "—";
    const rawError = s.lastError || (cfg._lastError ? String(cfg._lastError) : null);
    const errorActive = isActiveAgentError({
      lastError: rawError,
      lastErrorTime: cfg._lastErrorTime ? String(cfg._lastErrorTime) : null,
      circuitBreakerState: cb === "—" ? null : cb,
      lastLoginAt: cfg._lastLoginAt ? String(cfg._lastLoginAt) : null,
      leadsCollected: typeof cfg._agentLeads === "number" ? cfg._agentLeads : 0,
    });
    return {
      email: s.workspace.user?.email || "?",
      login: String(cfg.login || s.id.slice(0, 8)),
      sourceId: s.id,
      enabled: s.enabled,
      online: age != null && age < OFFLINE_MS,
      hbAgeMin: age != null ? Math.floor(age / 60000) : null,
      cb,
      lastError: errorActive ? rawError : null,
      leadsToday: todayMap.get(s.workspaceId) || 0,
      telegramAttemptedToday: tgAttemptedMap.get(s.workspaceId) || 0,
      telegramDeliveredToday: tgDeliveredMap.get(s.workspaceId) || 0,
    };
  });
}

async function alertOfflineAgents(admin: { token: string; chat: string }) {
  const sources = await db.source.findMany({
    where: { platform: "profi", enabled: true, workspace: { user: { role: "user" } } },
  });
  for (const s of sources) {
    const cfg = (s.config as Record<string, unknown>) || {};
    const hbRaw = cfg._lastHeartbeat;
    if (!hbRaw) continue;
    const age = Date.now() - new Date(String(hbRaw)).getTime();
    if (age < OFFLINE_MS) continue;
    if (!cooldown("offline_" + s.id, 60 * 60 * 1000)) continue;

    const login = String(cfg.login || s.id.slice(0, 8));
    const min = Math.floor(age / 60000);
    const ok = await tg(
      admin.token,
      admin.chat,
      [
        `🔴 *Агент offline >15 мин*`,
        `Profi: \`${login}\``,
        `Heartbeat: ${min} мин назад`,
        `CB: ${((cfg._circuitBreaker as { state?: string })?.state) || "—"}`,
        `Не рестартить вход. Смотри Пульт.`,
      ].join("\n"),
    );
    if (!ok) notificationFailures++;
    await patchSourceAgentMeta(s.id, { _offlineAlertAt: new Date().toISOString() });
  }
}

async function eveningDigest(admin: { token: string; chat: string }) {
  if (mskHour() !== 21) return;
  if (!cooldown("evening_digest", 20 * 3600 * 1000)) return;

  const fleet = await fleetSnapshot();
  const online = fleet.filter((f) => f.online).length;
  const offline = fleet.filter((f) => !f.online).length;
  const cbBad = fleet.filter((f) => f.cb !== "CLOSED" && f.cb !== "—");
  const leadsToday = fleet.reduce((n, f) => n + f.leadsToday, 0);
  const errors = fleet.filter((f) => f.lastError).slice(0, 5);

  const lines = [
    `📊 *Сводка флота* ${mskTime()} МСК`,
    `Партнёры (Profi): *${fleet.length}* · online *${online}* · offline *${offline}*`,
    `Заявок сегодня: *${leadsToday}*`,
    ...fleet.map((f) => {
      const mismatch = f.telegramDeliveredToday < f.telegramAttemptedToday;
      const tracking =
        f.telegramAttemptedToday < f.leadsToday
          ? ` · учёт после запуска ${f.telegramDeliveredToday}/${f.telegramAttemptedToday}`
          : "";
      return `${mismatch ? "⚠ " : "✅ "}${f.login}: ${f.leadsToday} в БД · ${f.telegramDeliveredToday} в TG${tracking}`;
    }),
    cbBad.length ? `CB ≠ CLOSED: ${cbBad.map((f) => f.login + "/" + f.cb).join(", ")}` : `CB: все CLOSED`,
    errors.length
      ? `Ошибки: ${errors.map((f) => `${f.login}: ${(f.lastError || "").slice(0, 40)}`).join(" · ")}`
      : `Ошибок нет`,
  ];

  const ok = await tg(admin.token, admin.chat, lines.join("\n"));
  if (!ok) notificationFailures++;
  else console.log("[health] evening digest sent");
}

async function partnerPulse() {
  if (!LEGACY_PULSE) return;
  const h = mskHour();
  if (h < 8 || h > 20 || h % 3 !== 0) return;
  if (!cooldown("pulse_" + h, 150 * 60000)) return;
  const partners = await getPartnersLegacy();
  const { lastMin } = await leadsInfo();
  for (const p of partners) {
    if (!p.token || !p.chat) continue;
    const ok = await tg(
      p.token,
      p.chat,
      [
        `💚 *Leads AI — проверка связи* ${mskTime()} МСК`,
        `📥 Сегодня: *${p.today}* · Всего: *${p.total}*`,
        `⏱ Последняя заявка: ${lastMin != null ? lastMin + " мин назад" : "—"}`,
      ].join("\n"),
    );
    if (!ok) notificationFailures++;
  }
}

async function partnerHeartbeat() {
  if (!LEGACY_PULSE) return;
  const h = mskHour();
  if (h < 8 || h > 20 || h % 3 === 0) return;
  if (!cooldown("hb_" + h, 55 * 60000)) return;
  for (const p of await getPartnersLegacy()) {
    if (!p.token || !p.chat) continue;
    const ok = await tg(p.token, p.chat, `🟢 *Leads AI — хаб на связи* ${mskTime()} МСК`);
    if (!ok) notificationFailures++;
  }
}

async function check() {
  const dbUp = await dbOk();
  const tgUp = await tgOk();
  const leads = await leadsInfo();
  const admin = await adminChannel();

  if (!dbUp && cooldown("db", 15 * 60000)) {
    await tg(admin.token, admin.chat, "🔴 *БД недоступна!*");
  }
  if (!tgUp && cooldown("tg", 15 * 60000)) {
    await tg(admin.token, admin.chat, "🔴 *Telegram API недоступен!*");
  }

  if (HUB_COLLECTOR_POLICY.profiOnHub && leads.lastMin && leads.lastMin > 60 && cooldown("silent", 60 * 60000)) {
    await tg(admin.token, admin.chat, `🔴 *Нет заявок > ${leads.lastMin} мин*\nПроверь сессии Profi на VPS.`);
  }

  await alertOfflineAgents(admin);

  try {
    const report = await diagnose();
    if (report.findings.some((f) => f.heal === "clear_stale")) {
      const h = await healSafe(report, { allowRestartHealth: false });
      if (h.healed.length) console.log("[health] doctor healed", h.healed.join(", "));
    }
    if (report.level === "call_agent" && cooldown("doctor_call", 60 * 60 * 1000)) {
      const bad = report.findings.filter((f) => f.level === "call_agent").slice(0, 5);
      const ok = await tg(
        admin.token,
        admin.chat,
        [
          `🩺 *Доктор: зови агента*`,
          report.headline,
          ...bad.map((f) => `• ${f.title}`),
          `Пульт: https://leads.konversus.ru/dashboard/admin/ops`,
          `Не рестартить Profi/VPS.`,
        ].join("\n"),
      );
      if (!ok) notificationFailures++;
    }
  } catch (e) {
    console.error("[health] doctor", e instanceof Error ? e.message : e);
  }

  await eveningDigest(admin);

  if (notificationFailures >= 3 && cooldown("tg_fail_alert", 30 * 60000)) {
    await tg(admin.token, admin.chat, "🔴 *Telegram бот не отвечает!*\n3 ошибки подряд. Проверь токен.");
  }

  await partnerPulse();
  await partnerHeartbeat();

  const s = [
    dbUp ? "DB" : "!!DB",
    tgUp ? "TG" : "!!TG",
    "leads:" + leads.count,
    HUB_COLLECTOR_POLICY.profiOnHub ? "profiHub" : "profiOffHub",
    LEGACY_PULSE ? "legacyPulse" : "opsQuiet",
    notificationFailures > 0 ? "tg" + notificationFailures : "",
  ]
    .filter(Boolean)
    .join(" ");
  console.log("[health]", s, "next in", CHECK_MINUTES, "min");
}

console.log(
  "[health] v6 doctor — profiOnHub:",
  HUB_COLLECTOR_POLICY.profiOnHub,
  "legacyPulse:",
  LEGACY_PULSE,
  "interval:",
  CHECK_MINUTES,
  "min",
);
check();
setInterval(check, CHECK_MS);
