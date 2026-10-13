import assert from "node:assert/strict";
import test from "node:test";
import { AD_LIMITS, adsFromFindings, fitAd } from "./ads";
import type { PresentFinding } from "./present";

const findings: PresentFinding[] = [
  {
    id: "1",
    kind: "fact",
    title: "Как страница называет предложение",
    body: "Title: ООО «Континент» | Производство одежды для силовых структур",
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
];

test("ad lines stay inside Direct limits", () => {
  const long = "спецодежда ".repeat(40);
  assert.ok(fitAd(long, AD_LIMITS.title).length <= AD_LIMITS.title);
  assert.equal(fitAd("Подольск", 30), "Подольск");
});

test("drafts do not invent a price when the site fact has none", () => {
  const ads = adsFromFindings({
    company: "ООО «Континент»",
    niche: "Производство спецодежды",
    regionName: "Подольск",
    goal: "Заявки на пошив",
    findings,
  });
  assert.equal(ads.length, 2);
  const text = JSON.stringify(ads);
  for (const ad of ads) {
    assert.ok(ad.title.length <= AD_LIMITS.title);
    assert.ok(ad.title2.length <= AD_LIMITS.title2);
    assert.ok(ad.text.length <= AD_LIMITS.text);
  }
  assert.match(text, /Производство спецодежды/);
  assert.match(text, /Подольск/);
  assert.doesNotMatch(text, /скид|₽|руб|1 000/i);
  assert.match(ads.map((ad) => ad.basis).join(" "), /со страницы|из брифа/);
});
