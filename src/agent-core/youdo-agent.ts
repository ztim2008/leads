/**
 * YouDo agent entry — bundled to public/agent/v2/youdo.bundle.mjs
 * Отдельный PM2-процесс `leads-agent-youdo` рядом с Profi-агентом, без входа в аккаунт.
 * Env: API_URL, AGENT_SECRET, SOURCE_ID (источник platform=youdo)
 */

import { YouDoCollector } from "./youdo-collector";
import type { CircuitBreakerSnapshot } from "./types";

const API = process.env.API_URL || "https://leads.konversus.ru";
const SECRET = process.env.AGENT_SECRET || "leads-agent-secret-2026";
const SOURCE_ID = process.env.SOURCE_ID || "";

if (!SOURCE_ID) {
  console.error("[youdo-agent] ❌ SOURCE_ID не задан");
  process.exit(1);
}

const startTime = Date.now();
let totalErrors = 0;
let totalLeadsSent = 0;
let lastError = "";
let lastErrorTime = "";
let agentState = "init";

interface HubConfig {
  platform?: string;
  collectionPaused?: boolean;
  workHoursStart?: string;
  workHoursEnd?: string;
  youdo?: {
    categories?: string[];
    onlyVirtual?: boolean;
    pollMinSec?: number;
    pollMaxSec?: number;
  };
}

async function apiPost(path: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}/api/v2/agent/${path}`, {
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
  if (cfg.platform !== "youdo") throw new Error(`source platform is ${cfg.platform}, expected youdo`);
  return cfg;
}

async function heartbeat(cb?: CircuitBreakerSnapshot): Promise<void> {
  await apiPost("heartbeat", {
    status: {
      leads: totalLeadsSent,
      errors: totalErrors,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      memory: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024),
      lastError,
      lastErrorTime,
      agentState,
      circuitBreaker: cb || null,
    },
  });
}

function runtimeFrom(cfg: HubConfig) {
  return {
    categories: cfg.youdo?.categories,
    onlyVirtual: cfg.youdo?.onlyVirtual,
    pollMinSec: cfg.youdo?.pollMinSec,
    pollMaxSec: cfg.youdo?.pollMaxSec,
    workHoursStart: cfg.workHoursStart,
    workHoursEnd: cfg.workHoursEnd,
  };
}

async function main(): Promise<void> {
  console.log("[youdo-agent] 🚀 Запуск", SOURCE_ID, "API:", API);
  const config = await loadConfig();

  if (config.collectionPaused) {
    console.log("[youdo-agent] ⏸ Источник выключен на хабе. Heartbeat only.");
    agentState = "paused";
    setInterval(() => heartbeat().catch(() => {}), 5 * 60_000);
    await heartbeat();
    return;
  }

  const collector = new YouDoCollector({ sourceId: SOURCE_ID, headless: true, ...runtimeFrom(config) });

  setInterval(() => {
    loadConfig()
      .then((cfg) => collector.updateRuntime(runtimeFrom(cfg)))
      .catch((e) => console.error("[youdo-agent] config refresh:", e instanceof Error ? e.message : e));
  }, 2 * 60_000);

  setInterval(() => {
    heartbeat(collector.getBreakerState()).catch((e) =>
      console.error("[youdo-agent] heartbeat:", e instanceof Error ? e.message : e),
    );
  }, 5 * 60_000);

  agentState = "running";
  await heartbeat(collector.getBreakerState());

  await collector.start({
    onLead: async (lead) => {
      const res = await apiPost("leads", { leads: [lead] });
      const saved = typeof res.saved === "number" ? res.saved : 0;
      totalLeadsSent += saved;
      console.log(`[youdo-agent] ${saved > 0 ? "📥" : "·"} ${lead.title?.slice(0, 60)}`);
    },
    onError: (err) => {
      totalErrors++;
      lastError = err;
      lastErrorTime = new Date().toISOString();
      console.error("[youdo-agent] ❌", err);
    },
    onStatus: (s) => {
      console.log("[youdo-agent]", s);
      if (/^проверка:|лента открыта/.test(s)) {
        lastError = "";
        lastErrorTime = "";
      }
    },
    onCircuitChange: async (snap) => {
      if (snap.state === "OPEN") agentState = "cooldown";
      else if (snap.state === "BLOCKED") agentState = "blocked";
      else if (snap.state === "CLOSED") agentState = "running";
      if (snap.state === "OPEN" || snap.state === "BLOCKED") {
        await apiPost("alert", {
          type: `youdo_cb_${snap.state.toLowerCase()}`,
          message: snap.lastReason || snap.state,
          circuitBreaker: snap,
        }).catch(() => {});
      }
      await heartbeat(snap).catch(() => {});
    },
  });
}

main().catch((e) => {
  console.error("[youdo-agent] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
