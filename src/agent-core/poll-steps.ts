/** Случайная пауза между опросами ленты: ступень 1/3/6 мин ±20%, чтобы ритм не был машинным. */

const MIN_POLL_SEC = 45;
export const DEFAULT_POLL_STEPS_SEC = [60, 180, 360];
const POLL_JITTER = 0.2;

export function pickPollDelayMs(stepsSec?: number[], rnd: () => number = Math.random): number {
  const steps = (stepsSec || []).filter((n) => Number.isFinite(n) && n > 0);
  const pool = steps.length ? steps : DEFAULT_POLL_STEPS_SEC;
  const base = pool[Math.floor(rnd() * pool.length)] ?? pool[0];
  const jittered = base * (1 - POLL_JITTER + rnd() * 2 * POLL_JITTER);
  return Math.round(Math.max(MIN_POLL_SEC, jittered) * 1000);
}
