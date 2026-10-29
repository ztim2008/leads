import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseYouDoBudget } from "./youdo-collector";
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
