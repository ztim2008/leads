import { adsFromFindings } from "@/lib/briefs/ads";
import { adRows, twoCol, type BriefPdf, type PdfTable } from "@/lib/briefs/pdf";
import {
  SLOT_LABELS,
  SLOT_ORDER,
  WORDSTAT_PAUSE,
  findingsByKind,
  slotFinding,
  slotSummary,
  type PresentFinding,
} from "@/lib/briefs/present";
import { FINDING_KINDS, GROUP_LABELS } from "@/lib/briefs/sections";
import { strategyOutline } from "@/lib/briefs/strategy";
import { developerCompare, directologistCompare } from "@/lib/briefs/compare";
import { seoOutline } from "@/lib/briefs/seo";

const CONTENT_W = twoCol().reduce((sum, width) => sum + width, 0);

export function briefPdfDocument(input: {
  company: string;
  siteUrl: string;
  niche: string;
  regionName: string;
  goal: string;
  findings: PresentFinding[];
  semantics: PresentFinding[];
  notes: string;
}): BriefPdf {
  const hasSemantics = input.semantics.some((finding) => /^\d+$/.test(finding.evidenceQuote || ""));
  const outline = strategyOutline({ ...input, hasSemantics });
  const ads = adsFromFindings(input);
  const seo = seoOutline(input);
  const direct = directologistCompare(input);
  const developer = developerCompare(seo);
  const tables: PdfTable[] = [
    {
      title: "Карточка",
      headers: ["Поле", "Значение"],
      widths: twoCol(),
      rows: [
        ["Ниша", input.niche || "Нет данных"],
        ["Регион", input.regionName || "Нет данных"],
        ["Задача", input.goal || "Нет данных"],
      ],
    },
    {
      title: "Сайт",
      headers: ["Слот", "На странице"],
      widths: twoCol(),
      rows: SLOT_ORDER.map((slot) => {
        const finding = slotFinding(input.findings, slot);
        const value = finding ? slotSummary(finding, slot) : "Нет данных";
        const url = finding?.evidenceUrl || "";
        return [SLOT_LABELS[slot], url ? `${value}\n${url}` : value];
      }),
    },
  ];

  for (const kind of FINDING_KINDS) {
    const rows = findingsByKind(input.findings)[kind];
    tables.push({
      title: GROUP_LABELS[kind],
      headers: ["Пункт", "Текст"],
      widths: twoCol(132),
      rows: rows.map((finding) => [
        finding.title,
        finding.evidenceUrl ? `${finding.body}\n${finding.evidenceUrl}` : finding.body,
      ]),
    });
  }

  tables.push(semanticsTable(input.semantics, hasSemantics));
  tables.push({
    title: "Стратегия",
    headers: ["№", "Сейчас"],
    widths: twoCol(36),
    rows: outline.gaps.map((gap, index) => [String(index + 1), gap]),
  });
  tables.push({
    title: "Коммерческое предложение",
    headers: ["Поле", "Значение"],
    widths: twoCol(),
    rows: outline.proposal.map((row) => [row.label, row.value]),
  });
  tables.push({
    title: "Директологу",
    headers: ["Хорошо", "Плохо"],
    widths: [Math.round(CONTENT_W / 2), CONTENT_W - Math.round(CONTENT_W / 2)],
    rows: zipSides(direct.good, direct.bad),
  });
  tables.push({
    title: "Разработчику",
    headers: ["Хорошо", "Плохо"],
    widths: [Math.round(CONTENT_W / 2), CONTENT_W - Math.round(CONTENT_W / 2)],
    rows: zipSides(developer.good, developer.bad),
  });
  tables.push({
    title: "Объявления",
    headers: ["№", "Черновик"],
    widths: [36, CONTENT_W - 36],
    rows: adRows(ads),
  });

  return {
    company: input.company,
    siteUrl: input.siteUrl,
    intro: "Для чтения в мессенджере. Позиции и трафик не измерялись. Черновики объявлений в кабинет Директа не отправлены. Цену и срок ставит человек.",
    tables,
    notes: input.notes,
  };
}

function zipSides(good: string[], bad: string[]): string[][] {
  const count = Math.max(good.length, bad.length, 1);
  return Array.from({ length: count }, (_, index) => [good[index] || "", bad[index] || ""]);
}

function semanticsTable(findings: PresentFinding[], hasSemantics: boolean): PdfTable {
  if (!hasSemantics) {
    return {
      title: "Семантика",
      headers: ["№", "Сейчас"],
      widths: twoCol(36),
      rows: [["1", WORDSTAT_PAUSE]],
    };
  }
  return {
    title: "Семантика",
    headers: ["Запрос", "Показы за 30 дней"],
    widths: twoCol(CONTENT_W - 110),
    rows: findings
      .filter((finding) => /^\d+$/.test(finding.evidenceQuote || ""))
      .map((finding) => [finding.title, new Intl.NumberFormat("ru-RU").format(Number(finding.evidenceQuote))    ]),
  };
}
