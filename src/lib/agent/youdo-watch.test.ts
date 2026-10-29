import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { youdoWatchVerdict } from "./youdo-watch";

/** 12:00 МСК = 09:00 UTC */
const NOON = Date.UTC(2026, 9, 29, 9, 0, 0);
const ago = (min: number) => new Date(NOON - min * 60_000).toISOString();
const base = {
  workHoursStart: "08:00",
  workHoursEnd: "22:00",
  _agentUptime: 3600,
  _circuitBreaker: { state: "CLOSED" },
};

describe("youdoWatchVerdict", () => {
  it("unknown until first heartbeat", () => {
    assert.equal(youdoWatchVerdict({}, NOON).kind, "unknown");
  });

  it("ok when heartbeat and feed are fresh", () => {
    assert.equal(youdoWatchVerdict({ ...base, _lastHeartbeat: ago(3), _lastFeedOkAt: ago(5) }, NOON).kind, "ok");
  });

  it("offline after 15 min without heartbeat, any hour", () => {
    const v = youdoWatchVerdict({ ...base, _lastHeartbeat: ago(16) }, NOON);
    assert.equal(v.kind, "offline");
    const night = Date.UTC(2026, 9, 29, 23, 0, 0);
    assert.equal(youdoWatchVerdict({ ...base, _lastHeartbeat: new Date(night - 20 * 60_000).toISOString() }, night).kind, "offline");
  });

  it("feed stale in work hours", () => {
    const v = youdoWatchVerdict({ ...base, _lastHeartbeat: ago(2), _lastFeedOkAt: ago(25) }, NOON);
    assert.equal(v.kind, "feed");
    if (v.kind === "feed") assert.equal(v.minutes, 25);
  });

  it("feed stale is fine at night and right after start", () => {
    const night = Date.UTC(2026, 9, 29, 20, 0, 0);
    const cfg = { ...base, _lastHeartbeat: new Date(night - 60_000).toISOString(), _lastFeedOkAt: new Date(night - 3 * 3600_000).toISOString() };
    assert.equal(youdoWatchVerdict(cfg, night).kind, "ok");
    assert.equal(youdoWatchVerdict({ ...base, _agentUptime: 300, _lastHeartbeat: ago(1) }, NOON).kind, "ok");
  });

  it("circuit breaker open counts as feed problem", () => {
    const v = youdoWatchVerdict(
      { ...base, _lastHeartbeat: ago(1), _lastFeedOkAt: ago(4), _circuitBreaker: { state: "OPEN" } },
      NOON,
    );
    assert.equal(v.kind, "feed");
  });
});
