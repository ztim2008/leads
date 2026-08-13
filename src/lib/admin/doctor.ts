/**
 * System Doctor — живой диагноз хаба + флота VPS-агентов.
 * Лечит только безопасное. Никогда: Playwright/Profi на хабе, рестарт VPS-агента, сброс CB при login_failed.
 */
import { execSync } from "child_process";
import { db } from "@/lib/db";
import { HUB_COLLECTOR_POLICY } from "@/config/hub";
import { isActiveAgentError } from "@/lib/agent/stale-error";
import { patchSourceAgentMeta } from "@/lib/agent/source-config";
import { isWithinWorkHours, worstLevel, type DoctorLevel } from "@/lib/admin/doctor-helpers";
import { resolveServiceBotToken, telegramGetMe } from "@/lib/telegram/bot-token";

export type { DoctorLevel };
export { isWithinWorkHours, worstLevel };

export type DoctorFinding = {
  id: string;
  level: DoctorLevel;
  title: string;
  detail: string;
  heal?: "clear_stale" | "restart_health";
};

export type DoctorReport = {
  at: string;
  level: DoctorLevel;
  headline: string;
  nextStep: string;
  findings: DoctorFinding[];
  systems: {
    hub: { ok: boolean; http: number | null; profiOnHub: boolean };
    db: boolean;
    telegram: boolean;
    pm2: Record<string, { status: string; restarts?: number; memoryMb?: number }>;
    fleet: {
      total: number;
      online: number;
      offlineWork: number;
      offlineSleep: number;
      cbBad: number;
      activeErrors: number;
      leadsToday: number;
    };
  };
  healed?: string[];
};

function pm2Leads(): DoctorReport["systems"]["pm2"] {
  try {
    const raw = execSync("pm2 jlist 2>/dev/null", { timeout: 5000, encoding: "utf8" });
    const procs = JSON.parse(raw) as Array<{
      name?: string;
      pm2_env?: { status?: string; restart_time?: number };
      monit?: { memory?: number };
    }>;
    const out: DoctorReport["systems"]["pm2"] = {};
    for (const p of procs) {
      if (!p.name?.startsWith("leads-")) continue;
      out[p.name] = {
        status: p.pm2_env?.status || "unknown",
        restarts: p.pm2_env?.restart_time,
        memoryMb: p.monit?.memory ? Math.round(p.monit.memory / 1024 / 1024) : undefined,
      };
    }
    return out;
  } catch {
    return {};
  }
}

async function hubHttp(): Promise<number | null> {
  try {
    const r = await fetch("http://127.0.0.1:3005/", { signal: AbortSignal.timeout(4000) });
    return r.status;
  } catch {
    return null;
  }
}

async function dbOk(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function tgCheck(): Promise<{ ok: boolean; detail?: string }> {
  const { token, source } = await resolveServiceBotToken();
  if (!token) {
    return { ok: false, detail: "Нет токена ни в .env, ни в настройках партнёра." };
  }
  const me = await telegramGetMe(token);
  if (!me.ok) {
    return { ok: false, detail: `getMe не прошёл (источник токена: ${source}).` };
  }
  return { ok: true, detail: `@${me.username || "bot"} · ${source}` };
}

export async function diagnose(): Promise<DoctorReport> {
  const findings: DoctorFinding[] = [];
  const [http, dbUp, tg, pm2] = await Promise.all([hubHttp(), dbOk(), tgCheck(), Promise.resolve(pm2Leads())]);
  const tgUp = tg.ok;

  if (HUB_COLLECTOR_POLICY.profiOnHub) {
    findings.push({
      id: "profi_on_hub",
      level: "call_agent",
      title: "Profi на хабе включён",
      detail: "Это запрещено. Не запускай leads-profi. Нужен агент.",
    });
  }

  if (http !== 200) {
    findings.push({
      id: "hub_http",
      level: "call_agent",
      title: "Хаб не отвечает 200",
      detail: `localhost:3005 → ${http ?? "нет ответа"}`,
    });
  }

  if (!dbUp) {
    findings.push({
      id: "db",
      level: "call_agent",
      title: "База недоступна",
      detail: "Prisma SELECT 1 не прошёл.",
    });
  }

  if (!tgUp) {
    findings.push({
      id: "tg",
      level: "warn",
      title: "Telegram API не отвечает",
      detail: tg.detail || "Заявки могут не уходить партнёру.",
    });
  }

  const hubPm = pm2["leads-konversus"];
  if (hubPm && hubPm.status !== "online") {
    findings.push({
      id: "pm2_hub",
      level: "call_agent",
      title: "PM2 leads-konversus не online",
      detail: `status=${hubPm.status}`,
    });
  }

  const healthPm = pm2["leads-health"];
  if (!healthPm || healthPm.status !== "online") {
    findings.push({
      id: "pm2_health",
      level: "warn",
      title: "Health-монитор не online",
      detail: healthPm ? `status=${healthPm.status}` : "процесса нет",
      heal: "restart_health",
    });
  }

  if (pm2["leads-profi"] && pm2["leads-profi"].status === "online") {
    findings.push({
      id: "leads_profi",
      level: "call_agent",
      title: "leads-profi запущен на хабе",
      detail: "Остановить вручную. Авторестарт Profi запрещён.",
    });
  }

  const todayMsk = new Date(Date.now() + 3 * 3600 * 1000);
  todayMsk.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date(todayMsk.getTime() - 3 * 3600 * 1000);

  const sources = await db.source.findMany({
    where: { platform: "profi", workspace: { user: { role: { not: "admin" } } } },
    include: { workspace: { include: { settings: true, _count: { select: { leads: true } } } } },
  });
  const todayCounts = await db.lead.groupBy({
    by: ["workspaceId"],
    where: { createdAt: { gte: todayStart } },
    _count: { _all: true },
  });
  const todayMap = new Map(todayCounts.map((c) => [c.workspaceId, c._count._all]));

  let online = 0;
  let offlineWork = 0;
  let offlineSleep = 0;
  let cbBad = 0;
  let activeErrors = 0;
  let leadsToday = 0;
  let staleCount = 0;

  for (const s of sources) {
    const cfg = (s.config as Record<string, unknown>) || {};
    const cb = (cfg._circuitBreaker as { state?: string } | undefined)?.state || "";
    const hb = cfg._lastHeartbeat ? new Date(String(cfg._lastHeartbeat)).getTime() : null;
    const isOnline = hb != null && Date.now() - hb < 15 * 60 * 1000;
    const start = String(cfg.workHoursStart || "08:00");
    const end = String(cfg.workHoursEnd || "22:00");
    const working = isWithinWorkHours(start, end);
    const today = todayMap.get(s.workspaceId) || 0;
    leadsToday += today;
    const login = String(cfg.login || s.id.slice(0, 8));
    const liveError = s.lastError || (cfg._lastError ? String(cfg._lastError) : null);
    const active = isActiveAgentError({
      lastError: liveError,
      lastErrorTime: cfg._lastErrorTime ? String(cfg._lastErrorTime) : null,
      circuitBreakerState: cb || null,
      lastLoginAt: cfg._lastLoginAt ? String(cfg._lastLoginAt) : null,
      leadsCollected: (typeof cfg._agentLeads === "number" ? cfg._agentLeads : 0) || today,
    });

    if (isOnline) online += 1;
    else if (s.enabled && working) offlineWork += 1;
    else offlineSleep += 1;

    if (cb && cb !== "CLOSED") {
      cbBad += 1;
      findings.push({
        id: `cb_${s.id}`,
        level: cb === "BLOCKED" ? "call_agent" : "call_agent",
        title: `CB ${cb}: ${login}`,
        detail: "Не рестартить вход. Пауза / SMS / ручной сброс CB после партнёра у ПК.",
      });
    }

    if (active && liveError) {
      activeErrors += 1;
      findings.push({
        id: `err_${s.id}`,
        level: /login_failed/i.test(liveError) ? "call_agent" : "warn",
        title: `Живая ошибка: ${login}`,
        detail: liveError.slice(0, 120),
      });
    } else if (liveError) {
      staleCount += 1;
    }

    if (s.enabled && !isOnline && working) {
      findings.push({
        id: `offline_${s.id}`,
        level: "call_agent",
        title: `Агент offline в рабочие часы: ${login}`,
        detail: hb ? `heartbeat ${Math.floor((Date.now() - hb) / 60000)} мин назад` : "heartbeat никогда не было",
      });
    }

    if (s.enabled && !s.workspace.settings?.telegramChatId) {
      findings.push({
        id: `tgchat_${s.id}`,
        level: "warn",
        title: `Нет Telegram партнёра: ${login}`,
        detail: "Заявки в БД будут, в чат — нет. Нужен /start бота.",
      });
    }
  }

  if (staleCount > 0) {
    findings.push({
      id: "stale_errors",
      level: "warn",
      title: `Архивные ошибки: ${staleCount}`,
      detail: "login_failed после успешного входа. Можно сбросить с пульта — это не поломка.",
      heal: "clear_stale",
    });
  }

  const fleet = {
    total: sources.length,
    online,
    offlineWork,
    offlineSleep,
    cbBad,
    activeErrors,
    leadsToday,
  };

  const level = worstLevel(findings.map((f) => f.level));
  const headline =
    level === "ok"
      ? "Всё работает. Агента не зови."
      : level === "warn"
        ? "Система живая, есть мелочи. Можно вылечить без агента."
        : "Нужен агент: сам не лечу вход в Profi и VPS.";

  const nextStep =
    level === "ok"
      ? "Смотри поток на пульте. Следующая проверка через 30 с."
      : level === "warn"
        ? "Нажми «Вылечить безопасное» или подожди автодоктора (каждые 5 мин)."
        : findings.find((f) => f.level === "call_agent")?.detail || "Открой Пульт → строка партнёра. Не рестартить Playwright.";

  return {
    at: new Date().toISOString(),
    level,
    headline,
    nextStep,
    findings,
    systems: {
      hub: { ok: http === 200, http, profiOnHub: HUB_COLLECTOR_POLICY.profiOnHub },
      db: dbUp,
      telegram: tgUp,
      pm2,
      fleet,
    },
  };
}

export async function healSafe(
  report?: DoctorReport,
  opts?: { allowRestartHealth?: boolean },
): Promise<{ ok: true; healed: string[] }> {
  const r = report || (await diagnose());
  const healed: string[] = [];
  const allowRestartHealth = opts?.allowRestartHealth !== false;
  const heals = new Set(
    r.findings
      .map((f) => f.heal)
      .filter((h): h is NonNullable<DoctorFinding["heal"]> => !!h)
      .filter((h) => (h === "restart_health" ? allowRestartHealth : true)),
  );

  if (heals.has("clear_stale")) {
    const sources = await db.source.findMany({
      where: { platform: "profi", workspace: { user: { role: { not: "admin" } } } },
    });
    for (const s of sources) {
      const cfg = (s.config as Record<string, unknown>) || {};
      const liveError = s.lastError || (cfg._lastError ? String(cfg._lastError) : null);
      const cb = (cfg._circuitBreaker as { state?: string } | undefined)?.state || "";
      const active = isActiveAgentError({
        lastError: liveError,
        lastErrorTime: cfg._lastErrorTime ? String(cfg._lastErrorTime) : null,
        circuitBreakerState: cb || null,
        lastLoginAt: cfg._lastLoginAt ? String(cfg._lastLoginAt) : null,
        leadsCollected: typeof cfg._agentLeads === "number" ? cfg._agentLeads : 0,
      });
      if (!liveError || active) continue;
      await db.source.update({
        where: { id: s.id },
        data: { lastError: null, status: "ok" },
      });
      await patchSourceAgentMeta(s.id, {
        _lastError: null,
        _lastErrorArchived: liveError,
        _lastErrorTime: cfg._lastErrorTime || null,
        _doctorHealedAt: new Date().toISOString(),
      });
      healed.push(`stale:${String(cfg.login || s.id.slice(0, 8))}`);
    }
  }

  if (heals.has("restart_health")) {
    try {
      execSync("pm2 restart leads-health", { timeout: 15000 });
      healed.push("pm2:leads-health");
    } catch (e) {
      healed.push("pm2:leads-health:fail");
      console.error("[doctor] restart leads-health", e);
    }
  }

  return { ok: true, healed };
}
