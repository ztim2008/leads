/** Ошибка агента «сейчас», а не архив после успешного входа. */

export const ACTIVE_ERROR_MS = 15 * 60 * 1000;

export function isActiveAgentError(opts: {
  lastError?: string | null;
  lastErrorTime?: string | null;
  circuitBreakerState?: string | null;
  lastLoginAt?: string | null;
  /** Успешные заявки после «ошибки» = вход уже ок. */
  leadsCollected?: number | null;
  now?: number;
}): boolean {
  const err = (opts.lastError || "").trim();
  if (!err) return false;

  const cb = opts.circuitBreakerState || "";
  if (cb === "OPEN" || cb === "BLOCKED" || cb === "HALF_OPEN") return true;

  if ((opts.leadsCollected || 0) > 0 && /login_failed/i.test(err)) return false;

  const now = opts.now ?? Date.now();
  if (opts.lastLoginAt && opts.lastErrorTime) {
    const loginAt = new Date(opts.lastLoginAt).getTime();
    const errAt = new Date(opts.lastErrorTime).getTime();
    if (!Number.isNaN(loginAt) && !Number.isNaN(errAt) && loginAt >= errAt) return false;
  }

  if (!opts.lastErrorTime) return false;
  const errAt = new Date(opts.lastErrorTime).getTime();
  if (Number.isNaN(errAt)) return false;
  return now - errAt < ACTIVE_ERROR_MS;
}
