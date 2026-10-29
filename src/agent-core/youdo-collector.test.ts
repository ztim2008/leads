import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseYouDoBudget, pickPollDelayMs } from "./youdo-collector";
import { formatLeadTelegram } from "@/lib/telegram/notifications";

describe("parseYouDoBudget", () => {
  it("reads «до N» with spaces and nbsp", () => {
    assert.equal(parseYouDoBudget("до 5 000"), 5000);
    assert.equal(parseYouDoBudget("до\u00a012\u00a0500"), 12500);
    assert.equal(parseYouDoBudget("до  500"), 500);
  });

  it("prefers explicit amount, empty when unknown", () => {
    assert.equal(parseYouDoBudget("до 1 000", 7000), 7000);
    assert.equal(parseYouDoBudget(""), undefined);
    assert.equal(parseYouDoBudget("договорная"), undefined);
  });
});

describe("YouDo telegram card", () => {
  const base = { title: "Создание лендинга", budget: "7 000 ₽", url: "https://youdo.com/t1" };

  it("marks YouDo in the header line", () => {
    const text = formatLeadTelegram({ ...base, platform: "youdo", responses: 0, replyTexts: [{ name: "A", text: "x" }] });
    const first = text.split("\n")[0];
    assert.match(first, /^🟠 <b>YouDo<\/b> · 🔥 <b>Создание лендинга<\/b>$/);
    assert.match(text, /вставьте на YouDo/);
  });

  it("leaves Profi header unchanged", () => {
    const text = formatLeadTelegram({ ...base, platform: "profi" });
    assert.match(text.split("\n")[0], /^📌 <b>Создание лендинга<\/b>$/);
  });
});

describe("pickPollDelayMs", () => {
  it("picks one of 1/3/6 min with ±20% jitter", () => {
    const seq = (a: number, b: number) => { let i = 0; return () => (i++ % 2 ? b : a); };
    assert.equal(pickPollDelayMs(undefined, seq(0, 0.5)), 60_000);
    assert.equal(pickPollDelayMs(undefined, seq(0.5, 0.5)), 180_000);
    assert.equal(pickPollDelayMs(undefined, seq(0.99, 0.5)), 360_000);
    assert.equal(pickPollDelayMs(undefined, seq(0.99, 0.999)), Math.round(360 * 1.1996 * 1000));
  });

  it("never below 45 s, custom steps respected", () => {
    for (let i = 0; i < 200; i++) {
      const ms = pickPollDelayMs();
      assert.ok(ms >= 48_000 && ms <= 432_000, String(ms));
    }
    assert.equal(pickPollDelayMs([10], () => 0), 45_000);
    assert.equal(pickPollDelayMs([120], () => 0.5), 120_000);
  });
});
