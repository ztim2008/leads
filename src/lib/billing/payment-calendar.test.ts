import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, buildBillingReport } from "./operator-pricing";
import { buildPaymentCalendar } from "./payment-calendar";

const start = new Date("2026-08-18T07:00:00Z");
const end = addDays(start, 30);

describe("buildPaymentCalendar", () => {
  it("текущий период + два следующих", () => {
    const report = buildBillingReport({
      connectedAt: start,
      periodStart: start,
      expiresAt: end,
      billingMode: "monthly",
      pausedAt: null,
      connectFeePaid: true,
      periodPaid: false,
      now: start,
    });
    const slots = buildPaymentCalendar({
      connectedAt: start,
      periodStart: start,
      expiresAt: end,
      report,
      now: start,
    });
    assert.equal(slots.length, 3);
    assert.equal(slots[0].role, "current");
    assert.equal(slots[0].paid, false);
    assert.equal(slots[1].role, "upcoming");
    assert.equal(slots[2].role, "upcoming");
  });
});
