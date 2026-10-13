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
  assert.match(text, /Цены текстом на изученных страницах нет/);
  assert.match(text, /viewport/i);
  assert.match(text, /спецодежд/);
  assert.doesNotMatch(text, /топ-\d|на \d+ месте|трафик \d|посетител/i);
});

test("developer rows name the pages and keep the fix separate from the fact", () => {
  const rows = seoOutline({
    niche: "Производство спецодежды",
    regionName: "Подольск",
    findings: [
      ...findings,
      {
        id: "4",
        kind: "fact",
        title: "Заголовки изученных страниц",
        body: [
          "https://www.k-spec.ru/: title 89 знаков; H1 нет; описание 71 знаков",
          "https://www.k-spec.ru/uslugi: title 24 знаков; H1: Услуги; описание 285 знаков",
          "https://www.k-spec.ru/kontakty: title 26 знаков; H1: Контакты (2 H1); описания нет",
        ].join("\n"),
        evidenceUrl: "https://www.k-spec.ru/",
        evidenceQuote: "ООО «Континент»",
      },
    ],
  });
  const h1 = rows.find((row) => row.check === "H1");
  assert.equal(h1?.tone, "bad");
  assert.match(h1?.fact || "", /1 из 3 страниц: https:\/\/www\.k-spec\.ru\/\./);
  assert.match(h1?.action || "", /Поставить один H1/);
  assert.doesNotMatch(h1?.fact || "", /Поставить/);

  assert.match(rows.find((row) => row.check === "Несколько H1")?.fact || "", /kontakty/);
  const description = rows.find((row) => row.check === "Мета-описание");
  assert.match(description?.fact || "", /Описания нет на https:\/\/www\.k-spec\.ru\/kontakty/);
  assert.match(description?.fact || "", /длиннее 160 знаков: https:\/\/www\.k-spec\.ru\/uslugi/);
  assert.equal(rows.filter((row) => row.check === "Мета-описание").length, 1);
});
