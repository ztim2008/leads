/**
 * DoD Этап 1: 3 искусственные ошибки входа → CB OPEN → 0 новых попыток 60 мин.
 *
 * Run: npx tsx --test src/agent-core/circuit-breaker.test.ts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { CircuitBreaker } from "./circuit-breaker";
import { ProfiCollector } from "./profi-collector";

describe("CircuitBreaker", () => {
  it("3 failures in 10 min → OPEN, then canAttempt=false", () => {
    let now = 1_000_000;
    const cb = new CircuitBreaker({
      now: () => now,
      failThreshold: 3,
      failWindowMs: 10 * 60 * 1000,
      openDurationMs: 60 * 60 * 1000,
    });

    assert.equal(cb.canAttempt(), true);
    cb.recordFailure("e1");
    assert.equal(cb.getState().state, "CLOSED");
    cb.recordFailure("e2");
    assert.equal(cb.getState().state, "CLOSED");
    cb.recordFailure("e3");

    const snap = cb.getState();
    assert.equal(snap.state, "OPEN");
    assert.equal(cb.canAttempt(), false);
    assert.ok(snap.openUntil === now + 60 * 60 * 1000);

    // Extra failures while OPEN must not change schedule (quiet mode)
    const until = snap.openUntil;
    cb.recordFailure("e4");
    cb.recordFailure("e5");
    assert.equal(cb.getState().state, "OPEN");
    assert.equal(cb.getState().openUntil, until);
    assert.equal(cb.canAttempt(), false);
  });

  it("after openDuration → HALF_OPEN; success → CLOSED", () => {
    let now = 0;
    const cb = new CircuitBreaker({
      now: () => now,
      failThreshold: 3,
      openDurationMs: 60_000,
    });

    cb.recordFailure("a");
    cb.recordFailure("b");
    cb.recordFailure("c");
    assert.equal(cb.getState().state, "OPEN");

    now = 60_001;
    assert.equal(cb.getState().state, "HALF_OPEN");
    assert.equal(cb.canAttempt(), true);

    cb.recordSuccess();
    assert.equal(cb.getState().state, "CLOSED");
    assert.equal(cb.canAttempt(), true);
  });

  it("HALF_OPEN failure → OPEN 120 min", () => {
    let now = 0;
    const cb = new CircuitBreaker({
      now: () => now,
      failThreshold: 3,
      openDurationMs: 60_000,
      reopenDurationMs: 120_000,
    });

    cb.recordFailure("a");
    cb.recordFailure("b");
    cb.recordFailure("c");
    now = 60_001;
    assert.equal(cb.getState().state, "HALF_OPEN");

    cb.recordFailure("probe_fail");
    assert.equal(cb.getState().state, "OPEN");
    assert.equal(cb.getState().openUntil, now + 120_000);
    assert.equal(cb.canAttempt(), false);
  });

  it("5 OPEN cycles → BLOCKED; only reset() unlocks", () => {
    let now = 0;
    const cb = new CircuitBreaker({
      now: () => now,
      failThreshold: 1,
      openDurationMs: 1000,
      reopenDurationMs: 1000,
      maxOpenCycles: 5,
    });

    for (let i = 0; i < 5; i++) {
      assert.notEqual(cb.getState().state, "BLOCKED");
      // CLOSED or HALF_OPEN — fail
      if (!cb.canAttempt()) {
        now += 2000;
      }
      cb.recordFailure(`cycle-${i}`);
      assert.ok(["OPEN", "BLOCKED"].includes(cb.getState().state));
      now += 2000; // advance past open
    }

    assert.equal(cb.getState().state, "BLOCKED");
    assert.equal(cb.canAttempt(), false);
    cb.recordFailure("ignored");
    assert.equal(cb.getState().state, "BLOCKED");

    cb.reset();
    assert.equal(cb.getState().state, "CLOSED");
    assert.equal(cb.canAttempt(), true);
  });

  it("persists state across new instance (PM2 restart)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "leads-cb-"));
    const statePath = path.join(dir, "state.json");
    let now = 5000;

    const cb1 = new CircuitBreaker({
      statePath,
      now: () => now,
      failThreshold: 3,
      openDurationMs: 60 * 60 * 1000,
    });
    cb1.recordFailure("1");
    cb1.recordFailure("2");
    cb1.recordFailure("3");
    assert.equal(cb1.getState().state, "OPEN");

    const cb2 = new CircuitBreaker({
      statePath,
      now: () => now,
      failThreshold: 3,
      openDurationMs: 60 * 60 * 1000,
    });
    assert.equal(cb2.getState().state, "OPEN");
    assert.equal(cb2.canAttempt(), false);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("ProfiCollector + CB (no Playwright login spam)", () => {
  it("3 login failures → OPEN → further runOnce does 0 login attempts", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "leads-agent-"));
    let now = 10_000;

    const breaker = new CircuitBreaker({
      now: () => now,
      failThreshold: 3,
      failWindowMs: 10 * 60 * 1000,
      openDurationMs: 60 * 60 * 1000,
      statePath: path.join(dir, "profiles", "src-test", "state.json"),
    });

    const collector = new ProfiCollector(
      {
        sourceId: "src-test",
        login: "fake",
        password: "fake",
        agentHome: dir,
        headless: true,
      },
      breaker,
    );

    // Simulate 3 login failures without touching Profi (direct CB)
    breaker.recordFailure("sim-1");
    breaker.recordFailure("sim-2");
    breaker.recordFailure("sim-3");
    assert.equal(breaker.getState().state, "OPEN");

    const attemptsBefore = collector.getLoginAttemptCount();
    const leads = await collector.runOnce();
    assert.deepEqual(leads, []);
    assert.equal(collector.getLoginAttemptCount(), attemptsBefore, "no new login while OPEN");

    // Still within 60 min
    now += 30 * 60 * 1000;
    await collector.runOnce();
    assert.equal(collector.getLoginAttemptCount(), attemptsBefore, "still zero logins for 60 min");

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
