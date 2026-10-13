import assert from "node:assert/strict";
import test from "node:test";
import { directologistChecks } from "./compare";
import type { PresentFinding } from "./present";
import { checkVerdict } from "./seo";

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

test("one row per check: fact from the page, action separately, bad before launch first", () => {
  const rows = directologistChecks({
    niche: "Производство спецодежды",
    regionName: "Подольск",
    findings,
  });
  assert.equal(rows[0].tone, "bad");
  assert.equal(checkVerdict(rows[0]), "Плохо · до запуска");
  assert.equal(rows[0].check, "Цена для объявления");
  assert.match(rows[0].action, /Не писать сумму/);

  const contact = rows.find((row) => row.check === "Связь");
  assert.equal(contact?.tone, "good");
  assert.match(contact?.fact || "", /\+74951425175/);
  assert.equal(contact?.url, "https://www.k-spec.ru/kontakty");

  const niche = rows.find((row) => row.check === "Ниша на посадочной");
  assert.equal(checkVerdict(niche!), "Плохо · можно позже");
  assert.match(niche?.fact || "", /спецодежд/);

  const city = rows.find((row) => row.check === "Город на посадочной");
  assert.match(city?.fact || "", /Подольск/);

  const order = rows.map((row) => (row.tone === "good" ? 2 : row.when === "before" ? 0 : 1));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.doesNotMatch(JSON.stringify(rows), /топ-\d|трафик \d/);
});

test("missing Metrika blocks the launch, missing call tracking does not", () => {
  const rows = directologistChecks({
    niche: "Производство спецодежды",
    regionName: "Подольск",
    findings: [
      ...findings,
      {
        id: "5",
        kind: "fact",
        title: "Счётчик Яндекс.Метрики в HTML не найден",
        body: "На изученных страницах нет кода mc.yandex.ru и вызова ym().",
        evidenceUrl: "https://www.k-spec.ru/",
        evidenceQuote: null,
      },
      {
        id: "6",
        kind: "fact",
        title: "Коллтрекинг и онлайн-чат не найдены",
        body: "Кодов Calltouch и подобных нет.",
        evidenceUrl: "https://www.k-spec.ru/",
        evidenceQuote: null,
      },
    ],
  });
  const metrika = rows.find((row) => row.check === "Яндекс.Метрика");
  assert.equal(checkVerdict(metrika!), "Плохо · до запуска");
  assert.match(metrika?.action || "", /Метрику до запуска/);
  assert.equal(checkVerdict(rows.find((row) => row.check === "Звонки из рекламы")!), "Плохо · можно позже");
});
