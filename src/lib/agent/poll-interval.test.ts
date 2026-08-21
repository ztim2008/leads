import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampPollRange,
  pollConfigPatch,
  resolvePollRange,
  POLL_ABSOLUTE_MIN,
} from "./poll-interval";

describe("poll-interval", () => {
  it("defaults to standard 3–7", () => {
    const r = resolvePollRange({});
    assert.equal(r.preset, "standard");
    assert.equal(r.minMinutes, 3);
    assert.equal(r.maxMinutes, 7);
  });

  it("resolves responsive preset", () => {
    const r = resolvePollRange({ pollPreset: "responsive" });
    assert.equal(r.minMinutes, 2);
    assert.equal(r.maxMinutes, 4);
  });

  it("never goes below absolute min", () => {
    const c = clampPollRange(0, 1);
    assert.equal(c.minMinutes, POLL_ABSOLUTE_MIN);
    assert.ok(c.maxMinutes >= c.minMinutes);
  });

  it("pollConfigPatch writes both fields", () => {
    const p = pollConfigPatch("calm");
    assert.equal(p.pollPreset, "calm");
    assert.equal(p.pollMinMinutes, 5);
    assert.equal(p.pollMaxMinutes, 9);
  });
});
