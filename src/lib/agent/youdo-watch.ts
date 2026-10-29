/** Сторож YouDo-агента: решение по данным heartbeat в source.config. Только сообщает, ничего не рестартит. */

export type YouDoWatchProblem = "offline" | "feed";

export type YouDoWatchVerdict =
  | { kind: "ok" }
  | { kind: "unknown" }
  | { kind: YouDoWatchProblem; minutes: number; cb: string; lastError: string | null };

export const YOUDO_OFFLINE_MS = 15 * 60_000;
export const YOUDO_FEED_STALE_MS = 20 * 60_000;
const START_GRACE_MS = 15 * 60_000;

function ts(v: unknown): number | null {
  if (!v) return null;
  const t = new Date(String(v)).getTime();
  return Number.isFinite(t) ? t : null;
}

function hourOf(v: unknown, fallback: number): number {
  const h = parseInt(String(v || "").split(":")[0] || "", 10);
  return Number.isFinite(h) ? h : fallback;
}

/** Внутри рабочих часов МСК и прошло ≥15 мин от их начала (агент успел открыть ленту). */
export function inYouDoWorkWindow(cfg: Record<string, unknown>, now: number): boolean {
  const msk = new Date(now + 3 * 3600_000);
  const minutes = msk.getUTCHours() * 60 + msk.getUTCMinutes();
  const start = hourOf(cfg.workHoursStart, 8) * 60 + START_GRACE_MS / 60_000;
  const end = hourOf(cfg.workHoursEnd, 22) * 60;
  return minutes >= start && minutes < end;
}

export function youdoWatchVerdict(cfg: Record<string, unknown>, now = Date.now()): YouDoWatchVerdict {
  const hb = ts(cfg._lastHeartbeat);
  if (!hb) return { kind: "unknown" };

  const cb = String((cfg._circuitBreaker as { state?: string } | null)?.state || "—");
  const lastError = cfg._lastError ? String(cfg._lastError) : null;

  const hbAge = now - hb;
  if (hbAge >= YOUDO_OFFLINE_MS) {
    return { kind: "offline", minutes: Math.floor(hbAge / 60_000), cb, lastError };
  }

  if (!inYouDoWorkWindow(cfg, now)) return { kind: "ok" };

  const uptimeMs = (Number(cfg._agentUptime) || 0) * 1000;
  if (uptimeMs < YOUDO_FEED_STALE_MS) return { kind: "ok" };

  const feedOk = ts(cfg._lastFeedOkAt);
  const feedAge = feedOk ? now - feedOk : uptimeMs;
  if (feedAge >= YOUDO_FEED_STALE_MS || cb === "OPEN" || cb === "BLOCKED") {
    return { kind: "feed", minutes: Math.floor(feedAge / 60_000), cb, lastError };
  }
  return { kind: "ok" };
}
