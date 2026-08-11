/**
 * agent-core — переиспользуемое ядро VPS-агента (Phase 1).
 *
 * НЕ запускать Playwright Profi на хабе (profiOnHub: false).
 */

export { CircuitBreaker } from "./circuit-breaker";
export { ProfileStore } from "./profile-store";
export { ProfiCollector } from "./profi-collector";
export {
  defaultAgentHome,
  globalStatePath,
  profileDir,
  readJsonFile,
  writeJsonFile,
} from "./paths";
export {
  BROWSER_PROFILES,
  pickDifferentProfile,
  pickRandomProfile,
  randomCheckIntervalMs,
  sleep,
  STEALTH_PROFILES,
} from "./profiles";
export { humanClick, humanMoveMouse, humanScroll, humanType } from "./human";
export type {
  BrowserProfile,
  CircuitBreakerOptions,
  CircuitBreakerSnapshot,
  CircuitState,
  CollectorCallbacks,
  NormalizedLead,
  ProfileMeta,
  ProfiCollectorConfig,
} from "./types";
