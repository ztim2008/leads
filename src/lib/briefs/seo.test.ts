import assert from "node:assert/strict";
import test from "node:test";
import type { PresentFinding } from "./present";
import { seoOutline } from "./seo";

const findings: PresentFinding[] = [
  {
    id: "1",
    kind: "fact",
    title: "Как страница называет предложение",
    body: "Title: ООО «Континент» | Производство одежды для силовых структур",
    evidenceUrl: "https://www.k-spec.ru/",
    evidenceQuote: "ООО «Континент»",
  },
  {
    id: "2",
    kind: "fact",
    title: "Цены на изученных страницах не найдены",
    body: "Фразы с суммой в рублях в тексте не встретились.",
    evidenceUrl: "https://www.k-spec.ru/",
    evidenceQuote: null,
  },
  {
    id: "3",
    kind: "fact",
    title: "На изученных страницах есть метка viewport",
    body: "Мета-тег viewport есть.",
    evidenceUrl: "https://www.k-spec.ru/",
    evidenceQuote: null,
  },
];

test("seo strategy stays inside the fetched page and does not invent rank", () => {
  const rows = seoOutline({
    niche: "Производство спецодежды",
    regionName: "Московская область, Подольск",
    findings,
  });
  const text = JSON.stringify(rows);
  assert.match(text, /H1 главной не найден/);
  assert.match(text, /Подольск/);
  assert.match(text, /цены в тексте не найдены/i);
  assert.match(text, /viewport/i);
  assert.match(text, /спецодежд/);
  assert.doesNotMatch(text, /топ-\d|на \d+ месте|трафик \d|посетител/i);
});
