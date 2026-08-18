import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, buildBillingReport } from "./operator-pricing";

const start = new Date("2026-08-18T07:00:00Z");
const end = addDays(start, 30);

describe("buildBillingReport VPS meter", () => {
  it("день старта: 1×40, к концу месяца 30×40", () => {
    const r = buildBillingReport({
      connectedAt: start,
      periodStart: start,
      expiresAt: end,
      billingMode: "monthly",
      pausedAt: null,
      connectFeePaid: false,
      now: start,
    });
    assert.equal(r.vpsDays, 1);
    assert.equal(r.vpsCost, 40);
    assert.equal(r.vpsDaysAtEnd, 30);
    assert.equal(r.vpsCostAtEnd, 1200);
    assert.equal(r.dueNow, 5000 + 1700 + 40);
    assert.equal(r.dueAtEnd, 5000 + 1700 + 1200);
  });

  it("на 12-й день VPS = 480, к концу 1200", () => {
    const r = buildBillingReport({
      connectedAt: start,
      periodStart: start,
      expiresAt: end,
      billingMode: "monthly",
      pausedAt: null,
      connectFeePaid: true,
      now: addDays(start, 12),
    });
    assert.equal(r.vpsDays, 12);
    assert.equal(r.vpsCost, 480);
    assert.equal(r.vpsCostAtEnd, 1200);
    assert.equal(r.dueNow, 1700 + 480);
    assert.equal(r.dueAtEnd, 1700 + 1200);
    assert.equal(r.accruedNow, 1700 + 480);
    assert.equal(r.periodPaid, false);
    assert.equal(r.paidLabel, "не оплачен");
    assert.equal(r.supportDue, 0);
    assert.equal(r.firstPeriod, true);
  });

  it("со 2-го месяца: поддержка 2000 + API 1700 + VPS, без подключения", () => {
    const r = buildBillingReport({
      connectedAt: start,
      periodStart: end,
      expiresAt: addDays(end, 30),
      billingMode: "monthly",
      pausedAt: null,
      connectFeePaid: true,
      periodIndex: 2,
      now: end,
    });
    assert.equal(r.firstPeriod, false);
    assert.equal(r.connectFeeDue, 0);
    assert.equal(r.supportDue, 2000);
    assert.equal(r.aiApiRub, 1700);
    assert.equal(r.dueNow, 2000 + 1700 + 40);
  });

  it("флаг оплачен: к оплате 0, начисление на месте", () => {
    const r = buildBillingReport({
      connectedAt: start,
      periodStart: start,
      expiresAt: end,
      billingMode: "monthly",
      pausedAt: null,
      connectFeePaid: true,
      periodPaid: true,
      now: addDays(start, 12),
    });
    assert.equal(r.periodPaid, true);
    assert.equal(r.paidLabel, "оплачен");
    assert.equal(r.dueNow, 0);
    assert.equal(r.dueAtEnd, 0);
    assert.equal(r.accruedNow, 1700 + 480);
  });

  it("в конце периода счётчик останавливается на 30 днях", () => {
    const r = buildBillingReport({
      connectedAt: start,
      periodStart: start,
      expiresAt: end,
      billingMode: "monthly",
      pausedAt: null,
      connectFeePaid: true,
      now: addDays(end, 3),
    });
    assert.equal(r.expired, true);
    assert.equal(r.vpsDays, 30);
    assert.equal(r.vpsCost, 1200);
  });

  it("пауза замораживает счётчик VPS", () => {
    const pausedAt = addDays(start, 10);
    const r = buildBillingReport({
      connectedAt: start,
      periodStart: start,
      expiresAt: end,
      billingMode: "paused",
      pausedAt,
      connectFeePaid: true,
      now: addDays(start, 20),
    });
    assert.equal(r.paused, true);
    assert.equal(r.vpsDays, 10);
    assert.equal(r.vpsCost, 400);
    assert.equal(r.daysLeft, 20);
  });
});
