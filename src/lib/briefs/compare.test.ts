import assert from "node:assert/strict";
import test from "node:test";
import { directologistCompare } from "./compare";
import type { PresentFinding } from "./present";

const findings: PresentFinding[] = [
  {
    id: "1",
    kind: "fact",
    title: "Главная страница открылась",
    body: "Ответ 200.",
    evidenceUrl: "https://www.k-spec.ru/",
    evidenceQuote: "ООО «Континент»",
  },
  {
    id: "2",
    kind: "fact",
    title: "Как страница называет предложение",
    body: "Title: ООО «Континент» | Производство одежды",
    evidenceUrl: "https://www.k-spec.ru/",
    evidenceQuote: "ООО «Континент»",
  },
  {
    id: "3",
    kind: "fact",
    title: "Цены на изученных страницах не найдены",
    body: "Сумм нет.",
    evidenceUrl: "https://www.k-spec.ru/",
    evidenceQuote: null,
  },
  {
    id: "4",
    kind: "fact",
    title: "Способы связи на изученных страницах",
    body: "https://www.k-spec.ru/kontakty: телефон: +74951425175",
    evidenceUrl: "https://www.k-spec.ru/kontakty",
    evidenceQuote: "+74951425175",
  },
];

test("directologist sees what can go into an ad and what cannot", () => {
  const side = directologistCompare({
    niche: "Производство спецодежды",
    regionName: "Подольск",
    findings,
  });
  const good = side.good.join(" ");
  const bad = side.bad.join(" ");
  assert.match(good, /открывается/);
  assert.match(good, /Связь/);
  assert.match(bad, /Цен/);
  assert.match(bad, /Подольск|спецодежд/);
  assert.doesNotMatch(`${good} ${bad}`, /топ-\d|трафик \d/);
});
