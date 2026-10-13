import assert from "node:assert/strict";
import test from "node:test";
import type { PresentFinding } from "./present";
import { renderBriefPdf, shortUrl } from "./pdf";
import { briefPercent } from "./progress";
import { briefPdfDocument } from "./reading";

const findings: PresentFinding[] = [
  {
    id: "1",
    kind: "fact",
    title: "Как страница называет предложение",
    body: "Title: ООО «Континент» | Производство одежды",
    evidenceUrl: "https://www.k-spec.ru/",
    evidenceQuote: "ООО «Континент»",
  },
  {
    id: "2",
    kind: "recommendation",
    title: "Показать срок на первом экране",
    body: "Срок уже написан на странице услуг.",
    evidenceUrl: "https://www.k-spec.ru/uslugi",
    evidenceQuote: "срок",
  },
];

test("reading pdf is a file with tables and no invented price", async () => {
  const doc = briefPdfDocument({
    company: "ООО «Континент»",
    siteUrl: "https://www.k-spec.ru/",
    niche: "Производство спецодежды",
    regionName: "Подольск",
    goal: "Заявки на пошив",
    findings,
    semantics: [],
    notes: "",
  });
  assert.ok(doc.tables.some((table) => table.title === "Объявления"));
  assert.ok(doc.tables.some((table) => table.title === "Директологу"));
  assert.ok(doc.tables.some((table) => table.title === "Разработчику"));
  assert.ok(doc.tables.some((table) => table.title === "Коммерческое предложение"));
  assert.doesNotMatch(JSON.stringify(doc), /скид|бюджет \d/i);
  const pdf = await renderBriefPdf(doc);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 4000);
  assert.match(pdf.toString("latin1"), /\/URI \(https:\/\/www\.k-spec\.ru\//);
});

test("client pdf keeps checks and offer but hides team notes", async () => {
  const doc = briefPdfDocument({
    company: "ООО «Континент»",
    siteUrl: "https://www.k-spec.ru/",
    niche: "Производство спецодежды",
    regionName: "Подольск",
    goal: "Заявки на пошив",
    findings,
    semantics: [],
    notes: "внутренняя заметка",
    audience: "client",
  });
  const titles = doc.tables.map((table) => table.title);
  assert.deepEqual(titles, ["Сайт", "Перед запуском рекламы", "Карта посадочных", "SEO и техника сайта", "Коммерческое предложение"]);
  assert.equal(doc.notes, "");
  assert.doesNotMatch(JSON.stringify(doc), /Заполняет человек|внутренняя заметка|кабинет не отправляются/);
  const pdf = await renderBriefPdf(doc);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
});

test("short links drop the protocol but keep the path", () => {
  assert.equal(shortUrl("https://www.k-spec.ru/"), "www.k-spec.ru");
  assert.equal(shortUrl("https://www.k-spec.ru/uslugi"), "www.k-spec.ru/uslugi");
});

test("progress only moves forward through the stages", () => {
  const steps = [
    briefPercent({ status: "queued", stage: null }),
    briefPercent({ status: "running", stage: "home" }),
    briefPercent({ status: "running", stage: "pages", pagesDone: 1, pagesTotal: 5 }),
    briefPercent({ status: "running", stage: "pages", pagesDone: 4, pagesTotal: 5 }),
    briefPercent({ status: "running", stage: "files" }),
    briefPercent({ status: "running", stage: "model" }),
    briefPercent({ status: "running", stage: "save" }),
    briefPercent({ status: "ready", stage: "save" }),
  ];
  assert.deepEqual(steps, [...steps].sort((a, b) => a - b));
  assert.equal(steps.at(-1), 100);
  assert.ok(steps.slice(0, -1).every((value) => value < 100));
});
