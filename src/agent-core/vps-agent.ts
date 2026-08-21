/**
 * VPS agent v2 entry — bundled to public/agent/v2/agent.bundle.mjs
 * Env: API_URL, AGENT_SECRET, SOURCE_ID
 */

import { ProfiCollector } from "./profi-collector";
import type { CircuitBreakerSnapshot } from "./types";

const API = process.env.API_URL || "https://leads.konversus.ru";
const SECRET = process.env.AGENT_SECRET || "leads-agent-secret-2026";
const SOURCE_ID = process.env.SOURCE_ID || "";

if (!SOURCE_ID) {
  console.error("[agent-v2] ❌ SOURCE_ID не задан");
  process.exit(1);
}

const startTime = Date.now();
let totalErrors = 0;
let totalLeadsSent = 0;
let lastError = "";
let lastErrorTime = "";
let agentState: string = "installing";

interface HubConfig {
  login: string;
  password: string;
  collectionPaused?: boolean;
  keywords?: string;
  workHoursStart?: string;
  workHoursEnd?: string;
  pollMinMinutes?: number;
  pollMaxMinutes?: number;
  antiDetect?: { mode?: "light" | "balanced" | "stealth" };
  proxy?: string;
}

async function apiPost(path: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const url = `${API}/api/v2/agent/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: SECRET, sourceId: SOURCE_ID, ...payload }),
    signal: AbortSignal.timeout(20_000),
  });
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return { error: `http ${res.status}` };
  }
}

async function loadConfig(): Promise<HubConfig> {
  const url = `${API}/api/v2/agent/config?secret=${encodeURIComponent(SECRET)}&sourceId=${encodeURIComponent(SOURCE_ID)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`config fetch failed: ${res.status}`);
  const cfg = (await res.json()) as HubConfig & { error?: string };
  if (cfg.error) throw new Error(cfg.error);
  if (!cfg.login || !cfg.password) throw new Error("login/password missing in hub config");
  return cfg;
}

function clearLastError(): void {
  lastError = "";
  lastErrorTime = "";
}

async function heartbeat(cb?: CircuitBreakerSnapshot, lastLoginAt?: string | null): Promise<void> {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const mem = Math.floor(process.memoryUsage().heapUsed / 1024 / 1024);
  await apiPost("heartbeat", {
    status: {
      leads: totalLeadsSent,
      errors: totalErrors,
      uptime,
      memory: mem,
      lastError,
      lastErrorTime,
      lastLoginAt: lastLoginAt || null,
      agentState,
      circuitBreaker: cb || null,
    },
  });
}

async function sendAlert(type: string, message: string, cb: CircuitBreakerSnapshot): Promise<void> {
  await apiPost("alert", { type, message, circuitBreaker: cb });
}

async function main(): Promise<void> {
  console.log("[agent-v2] 🚀 Запуск", SOURCE_ID);
  console.log("[agent-v2] API:", API);

  agentState = "init";
  const config = await loadConfig();

  if (config.collectionPaused) {
    console.log("[agent-v2] ⏸ Сбор остановлен (лимит или админ). Heartbeat only.");
    agentState = "paused";
    setInterval(() => {
      heartbeat().catch((e) =>
        console.error("[agent-v2] heartbeat:", e instanceof Error ? e.message : e),
      );
    }, 5 * 60 * 1000);
    await heartbeat();
    return;
  }

  console.log("[agent-v2] ✅ Конфиг:", config.login);

  const collector = new ProfiCollector({
    sourceId: SOURCE_ID,
    login: config.login,
    password: config.password,
    keywords: config.keywords,
    workHoursStart: config.workHoursStart,
    workHoursEnd: config.workHoursEnd,
    pollMinMinutes: config.pollMinMinutes,
    pollMaxMinutes: config.pollMaxMinutes,
    antiDetect: config.antiDetect,
    proxy: config.proxy,
    headless: true,
  });

  console.log(
    "[agent-v2] интервал ленты:",
    `${config.pollMinMinutes ?? 3}–${config.pollMaxMinutes ?? 7} мин`,
  );

  // Подтягивать интервал/часы с хаба без рестарта (админ сменил пресет)
  setInterval(() => {
    loadConfig()
      .then((cfg) => {
        collector.updateRuntime({
          workHoursStart: cfg.workHoursStart,
          workHoursEnd: cfg.workHoursEnd,
          pollMinMinutes: cfg.pollMinMinutes,
          pollMaxMinutes: cfg.pollMaxMinutes,
          antiDetect: cfg.antiDetect,
          keywords: cfg.keywords,
        });
      })
      .catch((e) =>
        console.error("[agent-v2] config refresh:", e instanceof Error ? e.message : e),
      );
  }, 2 * 60 * 1000);

  agentState = "running";

  const loginAtIso = (): string | null => {
    const ts = collector.profiles.getMeta().lastLoginAt;
    return ts ? new Date(ts).toISOString() : null;
  };

  setInterval(() => {
    heartbeat(collector.breaker.getState(), loginAtIso()).catch((e) =>
      console.error("[agent-v2] heartbeat:", e instanceof Error ? e.message : e),
    );
  }, 5 * 60 * 1000);

  await heartbeat(collector.breaker.getState(), loginAtIso());

  await collector.start({
    onLead: async (lead) => {
      const res = await apiPost("leads", { leads: [lead] });
      if (res.ok) {
        const saved = typeof res.saved === "number" ? res.saved : 1;
        if (saved > 0) {
          totalLeadsSent += saved;
          console.log("[agent-v2] 📥", lead.title?.slice(0, 60));
        }
      }
    },
    onError: (err) => {
      totalErrors++;
      lastError = err;
      lastErrorTime = new Date().toISOString();
      console.error("[agent-v2] ❌", err);
      if (/login_failed/i.test(err)) {
        sendAlert("login_failed", err, collector.breaker.getState()).catch(() => {});
      }
    },
    onStatus: (s) => {
      console.log("[agent-v2]", s);
      if (/вход выполнен|сессия восстановлена|проверка:/.test(s)) clearLastError();
    },
    onCircuitChange: async (snap) => {
      const next = snap.state;
      if (next === "OPEN") agentState = "cooldown";
      else if (next === "BLOCKED") agentState = "blocked";
      else if (next === "CLOSED") {
        agentState = "running";
        clearLastError();
      }

      if (next === "OPEN" || next === "BLOCKED") {
        await sendAlert(`cb_${next.toLowerCase()}`, snap.lastReason || next, snap);
      }
      await heartbeat(snap, loginAtIso());
    },
  });
}

main().catch((e) => {
  console.error("[agent-v2] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
