import assert from "node:assert/strict";
import test from "node:test";
import type { PresentFinding } from "./present";
import { renderBriefPdf } from "./pdf";
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
});
