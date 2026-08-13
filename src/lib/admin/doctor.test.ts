import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isWithinWorkHours, worstLevel } from "./doctor-helpers";

describe("doctor helpers", () => {
  it("worstLevel prefers call_agent", () => {
    assert.equal(worstLevel(["ok", "warn", "call_agent"]), "call_agent");
    assert.equal(worstLevel(["ok", "warn"]), "warn");
    assert.equal(worstLevel(["ok"]), "ok");
  });

  it("work hours MSK 08–22", () => {
    const mon10 = Date.parse("2026-08-13T07:00:00.000Z"); // 10:00 MSK
    const mon23 = Date.parse("2026-08-13T20:30:00.000Z"); // 23:30 MSK
    assert.equal(isWithinWorkHours("08:00", "22:00", mon10), true);
    assert.equal(isWithinWorkHours("08:00", "22:00", mon23), false);
  });
});
