import assert from "node:assert/strict";
import test from "node:test";
import type { PresentFinding } from "./present";
import { strategyOutline } from "./strategy";

const findings: PresentFinding[] = [
  {
    id: "1",
    kind: "recommendation",
    title: "Показать срок пошива на первом экране",
    body: "Срок уже есть на странице услуг.",
    evidenceUrl: "https://www.k-spec.ru/uslugi",
    evidenceQuote: "срок",
  },
];

test("proposal leaves price blank and does not invent demand", () => {
  const outline = strategyOutline({
    company: "ООО «Континент»",
    niche: "Производство спецодежды",
    regionName: "Подольск",
    goal: "Заявки на пошив",
    findings,
    hasSemantics: false,
  });
  const text = JSON.stringify(outline);
  assert.match(text, /Заполняет человек/);
  assert.match(text, /Показы Wordstat: нет данных/);
  assert.match(text, /Конкуренты в выдаче: нет данных/);
  assert.equal(outline.actions[0]?.title, "Показать срок пошива на первом экране");
  assert.doesNotMatch(text, /бюджет|ставк|прогноз \d/i);
});
