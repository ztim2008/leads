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
import { directologistChecks } from "@/lib/briefs/compare";
import { LANDING_HEADERS, landingMap } from "@/lib/briefs/landing";
import { ACTION_HEADER, CHECK_HEADER, FACT_HEADER, checkVerdict, seoOutline, type CheckRow } from "@/lib/briefs/seo";

const CONTENT_W = twoCol().reduce((sum, width) => sum + width, 0);
const LABEL_W = twoCol()[0];

/**
 * client — владельцу сайта: что хорошо и плохо, карта посадочных, КП. Без сырых фактов,
 * гипотез, черновиков объявлений и внутренних заметок.
 * team — директологу и разработчику: всё, что нашёл разбор.
 */
export type PdfAudience = "client" | "team";

export const PDF_EDITIONS: Record<PdfAudience, string> = {
  client: "Для клиента",
  team: "Для команды",
};

export function briefPdfDocument(input: {
  company: string;
  siteUrl: string;
  niche: string;
  regionName: string;
  goal: string;
  findings: PresentFinding[];
  semantics: PresentFinding[];
  notes: string;
  audience?: PdfAudience;
}): BriefPdf {
  const audience = input.audience ?? "team";
  const hasSemantics = input.semantics.some((finding) => /^\d+$/.test(finding.evidenceQuote || ""));
  const outline = strategyOutline({ ...input, hasSemantics });
  const seo = seoOutline(input);
  const direct = directologistChecks(input);
  const site = siteTable(input.findings);
  const landing: PdfTable = {
    title: "Карта посадочных",
    headers: LANDING_HEADERS,
    widths: [LABEL_W, Math.round((CONTENT_W - LABEL_W) / 2), CONTENT_W - LABEL_W - Math.round((CONTENT_W - LABEL_W) / 2)],
    rows: landingMap(input).map((row) => [row.group, `${row.fact}\n${row.url}`, row.action]),
  };

  if (audience === "client") {
    return {
      company: input.company,
      siteUrl: input.siteUrl,
      edition: PDF_EDITIONS.client,
      intro:
        "Что на сайте уже хорошо, что поправить до запуска и на какие страницы вести рекламу. Всё взято со страниц сайта. Позиции и трафик не измерялись.",
      tables: [
        site,
        checksTable("Перед запуском рекламы", direct),
        landing,
        checksTable("SEO и техника сайта", seo),
        {
          title: "Коммерческое предложение",
          headers: ["Поле", "Значение"],
          widths: twoCol(),
          rows: outline.proposal
            .filter((row) => row.value && !/^Заполняет человек/.test(row.value))
            .map((row) => [row.label, row.label === "Что делаем" ? "Кампания в Яндекс Директе по фактам сайта." : row.value]),
        },
      ],
      notes: "",
    };
  }

  const ads = adsFromFindings(input);
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
    site,
    checksTable("Директологу", direct),
    landing,
    checksTable("Разработчику", seo),
  ];

  for (const kind of FINDING_KINDS) {
    const rows = findingsByKind(input.findings)[kind];
    tables.push({
      title: GROUP_LABELS[kind],
      headers: ["Пункт", "Текст"],
      widths: twoCol(200),
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
    title: "Объявления",
    headers: ["№", "Черновик"],
    widths: [36, CONTENT_W - 36],
    rows: adRows(ads),
  });

  return {
    company: input.company,
    siteUrl: input.siteUrl,
    edition: PDF_EDITIONS.team,
    intro: "Для чтения в мессенджере. Позиции и трафик не измерялись. Черновики объявлений в кабинет Директа не отправлены. Цену и срок ставит человек.",
    tables,
    notes: input.notes,
  };
}

function siteTable(findings: PresentFinding[]): PdfTable {
  return {
    title: "Сайт",
    headers: ["Слот", "На странице"],
    widths: twoCol(),
    rows: SLOT_ORDER.map((slot) => {
      const finding = slotFinding(findings, slot);
      const value = finding ? slotSummary(finding, slot) : "Нет данных";
      const url = finding?.evidenceUrl || "";
      return [SLOT_LABELS[slot], url ? `${value}\n${url}` : value];
    }),
  };
}

function checksTable(title: string, rows: CheckRow[]): PdfTable {
  const fact = Math.round((CONTENT_W - LABEL_W) / 2);
  return {
    title,
    headers: [CHECK_HEADER, FACT_HEADER, ACTION_HEADER],
    widths: [LABEL_W, fact, CONTENT_W - LABEL_W - fact],
    rows: rows.map((row) => [
      `${checkVerdict(row)}\n${row.check}`,
      row.url ? `${row.fact}\n${row.url}` : row.fact,
      row.action,
    ]),
  };
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
    widths: twoCol(CONTENT_W - 140),
    rows: findings
      .filter((finding) => /^\d+$/.test(finding.evidenceQuote || ""))
      .map((finding) => [finding.title, new Intl.NumberFormat("ru-RU").format(Number(finding.evidenceQuote))]),
  };
}
