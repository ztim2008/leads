import assert from "node:assert/strict";
import test from "node:test";
import { companyName, slotOf, slotSummary, telegramBrief, type PresentFinding } from "./present";

const findings: PresentFinding[] = [
  {
    id: "1",
    kind: "fact",
    title: "Как страница называет предложение",
    body: "Title: ООО «Континент» | Производство одежды",
    evidenceUrl: "https://www.k-spec.ru/",
    evidenceQuote: "ООО «Континент» | Производство одежды",
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
    kind: "hypothesis",
    title: "Оптовые клиенты",
    body: "Стоит проверить спрос среди крупных заказчиков. Цитата длиннее, чем нужно для мессенджера, и не должна попасть целиком.",
    evidenceUrl: "https://www.k-spec.ru/uslugi",
    evidenceQuote: "ПРИ ЗАКАЗЕ ОТ 1 000 000Р",
  },
];

test("slots and company name come from the offer fact", () => {
  assert.equal(slotOf(findings[0].title), "offer");
  assert.equal(slotOf(findings[1].title), "prices");
  assert.equal(companyName(findings, "k-spec.ru"), "ООО «Континент»");
});

test("slot summaries stay short", () => {
  assert.equal(slotSummary(findings[1], "prices"), "Цены на изученных страницах не найдены");
  assert.doesNotMatch(slotSummary(findings[0], "offer"), /^Title:/);
});

test("telegram text keeps links and drops the long quote", () => {
  const text = telegramBrief({
    company: "ООО «Континент»",
    siteUrl: "https://www.k-spec.ru/",
    niche: "Производство спецодежды",
    regionName: "Московская область, Подольск",
    goal: "Заявки",
    findings,
  });
  assert.match(text, /ООО «Континент»/);
  assert.match(text, /https:\/\/www\.k-spec\.ru\/uslugi/);
  assert.match(text, /Гипотезы/);
  assert.match(text, /заполняет человек/);
  assert.doesNotMatch(text, /1 000 000Р/);
  assert.ok(text.length < 1200);
});
