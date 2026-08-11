/**
 * Circuit Breaker — защита аккаунта Profi от спама входами.
 *
 * Правила (TZ §4.3 / ANTI_BLOCK_PLAN):
 *   • 3 ошибки за 10 минут → OPEN (стоп 60 мин)
 *   • После 60 мин → HALF_OPEN (одна пробная попытка)
 *   • Успех → CLOSED; неудача → OPEN ещё на 120 мин
 *   • 5 циклов OPEN → BLOCKED (только ручной reset)
 *
 * Состояние пишется на диск — переживает рестарт PM2.
 */

import type { CircuitBreakerOptions, CircuitBreakerSnapshot, CircuitState } from "./types";
import { readJsonFile, writeJsonFile } from "./paths";

const DEFAULTS = {
  failThreshold: 3,
  failWindowMs: 10 * 60 * 1000,
  openDurationMs: 60 * 60 * 1000,
  reopenDurationMs: 120 * 60 * 1000,
  maxOpenCycles: 5,
} as const;

function emptySnapshot(now: number): CircuitBreakerSnapshot {
  return {
    state: "CLOSED",
    failCount: 0,
    windowFails: [],
    lastFailAt: null,
    openUntil: null,
    openCycles: 0,
    lastReason: null,
    alerted: false,
    updatedAt: now,
  };
}

export class CircuitBreaker {
  private readonly failThreshold: number;
  private readonly failWindowMs: number;
  private readonly openDurationMs: number;
  private readonly reopenDurationMs: number;
  private readonly maxOpenCycles: number;
  private readonly statePath?: string;
  private readonly now: () => number;
  private readonly onStateChange?: CircuitBreakerOptions["onStateChange"];

  private snap: CircuitBreakerSnapshot;

  constructor(opts: CircuitBreakerOptions = {}) {
    this.failThreshold = opts.failThreshold ?? DEFAULTS.failThreshold;
    this.failWindowMs = opts.failWindowMs ?? DEFAULTS.failWindowMs;
    this.openDurationMs = opts.openDurationMs ?? DEFAULTS.openDurationMs;
    this.reopenDurationMs = opts.reopenDurationMs ?? DEFAULTS.reopenDurationMs;
    this.maxOpenCycles = opts.maxOpenCycles ?? DEFAULTS.maxOpenCycles;
    this.statePath = opts.statePath;
    this.now = opts.now ?? (() => Date.now());
    this.onStateChange = opts.onStateChange;

    this.snap = this.statePath
      ? readJsonFile(this.statePath, emptySnapshot(this.now()))
      : emptySnapshot(this.now());

    // Advance OPEN → HALF_OPEN if timeout already passed (e.g. after PM2 restart).
    this.tick();
  }

  getState(): CircuitBreakerSnapshot {
    this.tick();
    return { ...this.snap, windowFails: [...this.snap.windowFails] };
  }

  /** true = можно пробовать вход / сбор. */
  canAttempt(): boolean {
    this.tick();
    return this.snap.state === "CLOSED" || this.snap.state === "HALF_OPEN";
  }

  /** Успешный вход или успешный цикл сбора. */
  recordSuccess(): void {
    this.tick();
    const prev = this.snap.state;
    this.snap = {
      ...this.snap,
      state: "CLOSED",
      failCount: 0,
      windowFails: [],
      lastFailAt: null,
      openUntil: null,
      lastReason: null,
      alerted: false,
      updatedAt: this.now(),
    };
    this.persist();
    this.emit(prev, "CLOSED");
  }

  /** Ошибка входа / сессии. Никогда не рестартит — только меняет состояние. */
  recordFailure(reason = "login_failed"): void {
    this.tick();
    const t = this.now();
    const prev = this.snap.state;

    if (prev === "BLOCKED") {
      this.snap = { ...this.snap, lastReason: reason, lastFailAt: t, updatedAt: t };
      this.persist();
      return;
    }

    if (prev === "HALF_OPEN") {
      const openCycles = this.snap.openCycles + 1;
      if (openCycles >= this.maxOpenCycles) {
        this.snap = {
          ...this.snap,
          state: "BLOCKED",
          failCount: this.snap.failCount + 1,
          lastFailAt: t,
          openUntil: null,
          openCycles,
          lastReason: reason,
          alerted: true,
          updatedAt: t,
        };
        this.persist();
        this.emit(prev, "BLOCKED");
        return;
      }
      this.snap = {
        ...this.snap,
        state: "OPEN",
        failCount: this.snap.failCount + 1,
        lastFailAt: t,
        openUntil: t + this.reopenDurationMs,
        openCycles,
        lastReason: reason,
        alerted: true,
        updatedAt: t,
      };
      this.persist();
      this.emit(prev, "OPEN");
      return;
    }

    if (prev === "OPEN") {
      // Already open — ignore extra failures (quiet mode).
      this.snap = { ...this.snap, lastReason: reason, lastFailAt: t, updatedAt: t };
      this.persist();
      return;
    }

    // CLOSED: sliding window
    const windowStart = t - this.failWindowMs;
    const windowFails = [...this.snap.windowFails.filter((x) => x >= windowStart), t];
    const failCount = this.snap.failCount + 1;

    if (windowFails.length >= this.failThreshold) {
      const openCycles = this.snap.openCycles + 1;
      if (openCycles >= this.maxOpenCycles) {
        this.snap = {
          state: "BLOCKED",
          failCount,
          windowFails,
          lastFailAt: t,
          openUntil: null,
          openCycles,
          lastReason: reason,
          alerted: true,
          updatedAt: t,
        };
        this.persist();
        this.emit(prev, "BLOCKED");
        return;
      }
      this.snap = {
        state: "OPEN",
        failCount,
        windowFails,
        lastFailAt: t,
        openUntil: t + this.openDurationMs,
        openCycles,
        lastReason: reason,
        alerted: true,
        updatedAt: t,
      };
      this.persist();
      this.emit(prev, "OPEN");
      return;
    }

    this.snap = {
      ...this.snap,
      state: "CLOSED",
      failCount,
      windowFails,
      lastFailAt: t,
      lastReason: reason,
      updatedAt: t,
    };
    this.persist();
  }

  /** Ручной сброс (кнопка админки / после разблокировки Profi). */
  reset(): void {
    const prev = this.snap.state;
    this.snap = emptySnapshot(this.now());
    this.persist();
    this.emit(prev, "CLOSED");
  }

  /** Продвинуть OPEN → HALF_OPEN по таймеру. */
  tick(): void {
    if (this.snap.state !== "OPEN") return;
    const t = this.now();
    if (this.snap.openUntil != null && t >= this.snap.openUntil) {
      const prev: CircuitState = "OPEN";
      this.snap = {
        ...this.snap,
        state: "HALF_OPEN",
        openUntil: null,
        updatedAt: t,
      };
      this.persist();
      this.emit(prev, "HALF_OPEN");
    }
  }

  private persist(): void {
    if (!this.statePath) return;
    writeJsonFile(this.statePath, this.snap);
  }

  private emit(prev: CircuitState, next: CircuitState): void {
    if (prev === next || !this.onStateChange) return;
    this.onStateChange(prev, next, this.getState());
  }
}
