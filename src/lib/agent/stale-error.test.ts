import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isActiveAgentError } from "./stale-error";

describe("isActiveAgentError", () => {
  const now = Date.parse("2026-08-13T16:00:00.000Z");

  it("empty is not active", () => {
    assert.equal(isActiveAgentError({ lastError: "", now }), false);
  });

  it("CB OPEN is always active", () => {
    assert.equal(
      isActiveAgentError({
        lastError: "login_failed",
        lastErrorTime: "2026-08-13T10:00:00.000Z",
        circuitBreakerState: "OPEN",
        now,
      }),
      true,
    );
  });

  it("stale login_failed after later login is archive", () => {
    assert.equal(
      isActiveAgentError({
        lastError: "login_failed: форма входа / неверный пароль / SMS / капча",
        lastErrorTime: "2026-08-13T08:00:00.000Z",
        lastLoginAt: "2026-08-13T12:00:00.000Z",
        circuitBreakerState: "CLOSED",
        now,
      }),
      false,
    );
  });

  it("login_failed after leads collected is archive", () => {
    assert.equal(
      isActiveAgentError({
        lastError: "login_failed: форма входа",
        lastErrorTime: "2026-08-13T15:50:00.000Z",
        circuitBreakerState: "CLOSED",
        leadsCollected: 9,
        now,
      }),
      false,
    );
  });

  it("fresh login_failed under 15 min is active", () => {
    assert.equal(
      isActiveAgentError({
        lastError: "login_failed",
        lastErrorTime: "2026-08-13T15:50:00.000Z",
        circuitBreakerState: "CLOSED",
        now,
      }),
      true,
    );
  });
});
