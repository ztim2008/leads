/**
 * Shared types for agent-core (Phase 1).
 * @see docs/TZ_LEADS_AI_V2.md §4
 * @see docs/AGENT_CORE.md
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN" | "BLOCKED";

export interface CircuitBreakerSnapshot {
  state: CircuitState;
  failCount: number;
  /** Failures inside the current sliding window (CLOSED only). */
  windowFails: number[];
  lastFailAt: number | null;
  openUntil: number | null;
  openCycles: number;
  lastReason: string | null;
  alerted: boolean;
  updatedAt: number;
}

export interface CircuitBreakerOptions {
  /** Failures in window to trip OPEN. Default 3. */
  failThreshold?: number;
  /** Sliding window for CLOSED failures. Default 10 min. */
  failWindowMs?: number;
  /** How long OPEN lasts before HALF_OPEN. Default 60 min. */
  openDurationMs?: number;
  /** OPEN duration after failed HALF_OPEN probe. Default 120 min. */
  reopenDurationMs?: number;
  /** OPEN cycles before BLOCKED. Default 5. */
  maxOpenCycles?: number;
  /** Persist path (JSON). If omitted — memory only. */
  statePath?: string;
  /** Clock for tests. */
  now?: () => number;
  onStateChange?: (prev: CircuitState, next: CircuitState, snap: CircuitBreakerSnapshot) => void;
}

export interface BrowserProfile {
  id: string;
  userAgent: string;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  platform: string;
  hasTouch: boolean;
  os: string;
  locale: string;
}

export interface ProfileMeta {
  sourceId: string;
  profileId: string;
  lastLoginAt: number | null;
  cookiesSavedAt: number | null;
}

export interface NormalizedLead {
  externalId: string;
  title: string;
  description: string;
  url: string;
  createdAt: string;
  city?: string;
  author?: string;
  budgetMin?: number;
  budgetMax?: number;
}

export interface CollectorCallbacks {
  onLead: (lead: NormalizedLead) => void | Promise<void>;
  onError?: (err: string) => void;
  onStatus?: (status: string) => void;
  onCircuitChange?: (snap: CircuitBreakerSnapshot) => void;
}

export interface ProfiCollectorConfig {
  sourceId: string;
  login: string;
  password: string;
  keywords?: string;
  proxy?: string;
  workHoursStart?: string;
  workHoursEnd?: string;
  /** Минуты между проверками ленты (админ). Default 3–7. Пол ≥ 2. */
  pollMinMinutes?: number;
  pollMaxMinutes?: number;
  antiDetect?: {
    mode?: "light" | "balanced" | "stealth";
    delayMultiplier?: number;
  };
  /** Root for ~/.leads-agent (override for tests). */
  agentHome?: string;
  headless?: boolean;
}
