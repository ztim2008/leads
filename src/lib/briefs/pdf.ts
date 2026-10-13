import { existsSync } from "fs";
import PDFDocument from "pdfkit";
import { AD_LIMITS, type AdDraft } from "@/lib/briefs/ads";

/** A4 альбом: на ноутбуке и повёрнутом телефоне таблица «факт / что сделать» читается без зума. */
const PAGE: [number, number] = [842, 595];
const MARGIN = 32;
const CONTENT_W = PAGE[0] - MARGIN * 2;

/** Светлые токены из globals.css :root — документ читают на белом фоне в мессенджере. */
const INK = "#0f172a";
const BODY = "#1e293b";
const MUTED = "#64748b";
const LINE = "#e5e7eb";
const HEAD = "#f8f9fa";
const PAPER = "#ffffff";
/** --accent из :root: ссылки должны отличаться от текста и быть кликабельными. */
const LINK = "#4f46e5";
const URL_LINE = /^https?:\/\/\S+$/;
/** --green / --amber / --red из :root. Цвет только у метки: светлые токены текстом на белом плохо читаются. */
const MARK_COLOR: Record<PdfMark, string> = {
  good: "#10b981",
  later: "#f59e0b",
  before: "#ef4444",
};
/** Меньше места внизу листа строку не начинаем — переносим целиком. */
const MIN_SPLIT = 72;
const PAD_TOP = 7;
const PAD_Y = 14;

const BRAND = {
  site: "https://konversus.ru",
  tagline: "Реклама в Яндекс Директе, которая приводит заявки",
  telegram: "@bilarius",
  email: "bilariuss@yandex.ru",
  phone: "+7 921 201-32-52",
};

const REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

export type PdfTable = {
  title: string;
  headers: string[];
  rows: string[][];
  widths: number[];
  /** Оценка строки: первая строка первой ячейки рисуется жирной с цветной меткой. */
  marks?: (PdfMark | null)[];
};

export type PdfMark = "good" | "later" | "before";

export type BriefPdf = {
  company: string;
  siteUrl: string;
  intro: string;
  tables: PdfTable[];
  notes: string;
  /** Подпись под шапкой: «Для клиента» или «Для команды». */
  edition: string;
};

export function renderBriefPdf(input: BriefPdf): Promise<Buffer> {
  if (!existsSync(REGULAR) || !existsSync(BOLD)) {
    return Promise.reject(new Error("Нет шрифта DejaVu для PDF"));
  }
  const doc = new PDFDocument({
    size: PAGE,
    margin: 0,
    info: { Title: input.company, Author: "Konversus Стратег" },
  });
  doc.registerFont("regular", REGULAR);
  doc.registerFont("bold", BOLD);
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  let y = MARGIN;
  let pageNumber = 1;
  const bottom = () => PAGE[1] - MARGIN - 18;

  const nextPage = () => {
    drawFooter(doc, pageNumber);
    pageNumber += 1;
    doc.addPage({ size: PAGE, margin: 0 });
    y = MARGIN;
  };

  const ensure = (height: number) => {
    if (y + height > bottom()) nextPage();
  };

  ensure(110);
  doc.font("bold").fontSize(14).fillColor(INK).text("Konversus", MARGIN, y, { continued: true, lineBreak: false });
  doc.font("regular").fontSize(10).fillColor(MUTED).text(`   ${BRAND.tagline}`, { lineBreak: false });
  doc
    .font("regular")
    .fontSize(11)
    .fillColor(LINK)
    .text(shortUrl(BRAND.site), MARGIN, y + 2, { width: CONTENT_W, align: "right", link: BRAND.site, underline: true, lineBreak: false });
  y += 24;
  doc.lineWidth(0.8).strokeColor(LINE).moveTo(MARGIN, y).lineTo(PAGE[0] - MARGIN, y).stroke();
  y += 16;
  const date = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  doc
    .font("regular")
    .fontSize(10)
    .fillColor(MUTED)
    .text(`Разбор сайта перед запуском Яндекс Директа · ${input.edition} · ${date.replace(/ г\.$/, "")}`, MARGIN, y, {
      width: CONTENT_W,
    });
  y = doc.y + 6;
  doc.font("bold").fontSize(18).fillColor(INK).text(input.company, MARGIN, y, { width: CONTENT_W });
  y = doc.y + 4;
  doc
    .font("regular")
    .fontSize(11)
    .fillColor(LINK)
    .text(shortUrl(input.siteUrl), MARGIN, y, { width: CONTENT_W, link: input.siteUrl, underline: true });
  y = doc.y + 6;
  doc.font("regular").fontSize(10).fillColor(MUTED).text(input.intro, MARGIN, y, { width: CONTENT_W, lineGap: 2 });
  y = doc.y + 16;

  for (const table of input.tables) {
    y = drawTable(doc, table, y, nextPage);
  }

  if (input.notes.trim()) {
    ensure(40);
    doc.font("bold").fontSize(14).fillColor(INK).text("Заметки", MARGIN, y, { width: CONTENT_W });
    y = doc.y + 6;
    doc.font("regular").fontSize(11).fillColor(BODY).text(input.notes.trim(), MARGIN, y, { width: CONTENT_W, lineGap: 2 });
    y = doc.y + 12;
  }

  const contacts = [
    ["Telegram", BRAND.telegram, `https://t.me/${BRAND.telegram.slice(1)}`],
    ["Почта", BRAND.email, `mailto:${BRAND.email}`],
    ["Телефон", BRAND.phone, `tel:${BRAND.phone.replace(/[^\d+]/g, "")}`],
    ["Сайт", shortUrl(BRAND.site), BRAND.site],
  ];
  ensure(70 + contacts.length * 20);
  y += 8;
  doc.lineWidth(0.8).strokeColor(LINE).moveTo(MARGIN, y).lineTo(PAGE[0] - MARGIN, y).stroke();
  y += 16;
  doc.font("bold").fontSize(14).fillColor(INK).text("Обсудить запуск рекламы", MARGIN, y, { width: CONTENT_W });
  y = doc.y + 4;
  doc
    .font("regular")
    .fontSize(11)
    .fillColor(BODY)
    .text("Напишите или позвоните: пройдём отчёт вместе, ответим на вопросы и предложим план кампании.", MARGIN, y, {
      width: CONTENT_W,
    });
  y = doc.y + 10;
  for (const [label, text, link] of contacts) {
    doc.font("regular").fontSize(11).fillColor(MUTED).text(label, MARGIN, y, { width: 90, lineBreak: false });
    doc.fillColor(LINK).text(text, MARGIN + 90, y, { link, underline: true, lineBreak: false });
    y += 20;
  }

  drawFooter(doc, pageNumber);
  doc.end();
  return done;

  function drawFooter(current: PDFKit.PDFDocument, page: number) {
    const cursor = current.y;
    const footerY = PAGE[1] - 20;
    current
      .font("regular")
      .fontSize(9)
      .fillColor(LINK)
      .text(shortUrl(BRAND.site), MARGIN, footerY, { link: BRAND.site, lineBreak: false });
    current.fillColor(MUTED).text(String(page), MARGIN, footerY, {
      width: CONTENT_W,
      align: "right",
      lineBreak: false,
    });
    current.y = cursor;
  }
}

function drawTable(
  doc: PDFKit.PDFDocument,
  table: PdfTable,
  startY: number,
  nextPage: () => void,
): number {
  const rows = table.rows.length ? table.rows : [["Нет данных"]];
  const bottomY = PAGE[1] - MARGIN - 18;
  const headerCells = table.headers.map((cell) => [cell]);
  const headerHeight = rowHeight(doc, headerCells, table.widths, true, null);
  const firstHeight = rowHeight(doc, toLines(rows[0], table.headers.length), table.widths, false, table.marks?.[0] ?? null);
  let y = startY;
  if (y + 28 + headerHeight + Math.min(firstHeight, MIN_SPLIT) > bottomY) {
    nextPage();
    y = MARGIN;
  }
  doc.font("bold").fontSize(14).fillColor(INK).text(table.title, MARGIN, y, { width: CONTENT_W });
  y = doc.y + 8;

  const paintHeader = () => {
    paintRow(doc, headerCells, table.widths, y, headerHeight, true, null);
    y += headerHeight;
  };
  const turnPage = () => {
    nextPage();
    y = MARGIN;
    paintHeader();
  };

  paintHeader();
  rows.forEach((row, index) => {
    let cells = toLines(row, table.headers.length);
    let mark = table.marks?.[index] ?? null;
    let fresh = false;
    for (;;) {
      const height = rowHeight(doc, cells, table.widths, false, mark);
      const room = bottomY - y;
      if (height <= room) {
        paintRow(doc, cells, table.widths, y, height, false, mark);
        y += height;
        return;
      }
      if (room >= MIN_SPLIT) {
        const parts = cells.map((lines, column) =>
          takeLines(doc, lines, table.widths[column], room - PAD_Y, column === 0 ? mark : null),
        );
        const placed = parts.some((part) => part.head.length > 0);
        if (placed || fresh) {
          const head = parts.map((part, column) => (placed ? part.head : cells[column]));
          paintRow(doc, head.map((lines) => (lines.length ? lines : [" "])), table.widths, y, room, false, mark);
          y += room;
          if (!placed) return;
          cells = parts.map((part) => part.tail);
          if (cells.every((lines) => lines.length === 0)) return;
          cells = cells.map((lines) => (lines.length ? lines : [" "]));
          if (parts[0].head.length > 0) mark = null;
        }
      }
      turnPage();
      fresh = true;
    }
  });
  return y + 16;
}

function toLines(row: string[], count: number): string[][] {
  const cells = row.slice(0, count);
  while (cells.length < count) cells.push("");
  return cells.map((cell) => (cell || " ").split("\n"));
}

function lineStyle(doc: PDFKit.PDFDocument, header: boolean, strong: boolean) {
  doc.font(header || strong ? "bold" : "regular").fontSize(header ? 10 : 11);
}

/** Ширина текста первой строки уже на место под метку. */
function lineWidth(width: number, marked: boolean): number {
  return width - 16 - (marked ? 14 : 0);
}

function lineHeight(doc: PDFKit.PDFDocument, line: string, width: number, header: boolean, marked: boolean): number {
  lineStyle(doc, header, marked);
  return doc.heightOfString(displayLine(line) || " ", { width: lineWidth(width, marked), lineGap: 1 });
}

function cellHeight(doc: PDFKit.PDFDocument, lines: string[], width: number, header: boolean, mark: PdfMark | null): number {
  return lines.reduce((sum, line, index) => sum + lineHeight(doc, line, width, header, Boolean(mark) && index === 0), 0);
}

function rowHeight(
  doc: PDFKit.PDFDocument,
  cells: string[][],
  widths: number[],
  header: boolean,
  mark: PdfMark | null,
): number {
  const textHeight = Math.max(
    ...cells.map((lines, index) => cellHeight(doc, lines, widths[index], header, index === 0 ? mark : null)),
  );
  return Math.max(28, textHeight + PAD_Y);
}

/** Сколько строк ячейки помещается в остаток листа; хвост уходит на следующий. */
function takeLines(
  doc: PDFKit.PDFDocument,
  lines: string[],
  width: number,
  budget: number,
  mark: PdfMark | null,
): { head: string[]; tail: string[] } {
  let used = 0;
  let count = 0;
  for (const [index, line] of lines.entries()) {
    const height = lineHeight(doc, line, width, false, Boolean(mark) && index === 0);
    if (used + height > budget) break;
    used += height;
    count += 1;
  }
  return { head: lines.slice(0, count), tail: lines.slice(count) };
}

/** Ссылка показывается без протокола, а кликается полным адресом. */
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function displayLine(line: string): string {
  return URL_LINE.test(line.trim()) ? shortUrl(line.trim()) : line;
}

function paintRow(
  doc: PDFKit.PDFDocument,
  cells: string[][],
  widths: number[],
  y: number,
  height: number,
  header: boolean,
  mark: PdfMark | null,
) {
  let x = MARGIN;
  cells.forEach((lines, index) => {
    const width = widths[index];
    doc.save();
    doc.rect(x, y, width, height).fill(header ? HEAD : PAPER);
    doc.restore();
    doc.lineWidth(0.6).strokeColor(LINE).rect(x, y, width, height).stroke();
    const bottom = y + height - 5;
    let lineY = y + PAD_TOP;
    lines.forEach((line, lineIndex) => {
      if (lineY >= bottom) return;
      const marked = !header && index === 0 && lineIndex === 0 && mark !== null;
      const trimmed = line.trim();
      const isLink = !header && URL_LINE.test(trimmed);
      const text = displayLine(line) || " ";
      if (marked) {
        doc.save();
        doc.circle(x + 12, lineY + 7, 4).fill(MARK_COLOR[mark]);
        doc.restore();
      }
      lineStyle(doc, header, marked);
      doc.fillColor(isLink ? LINK : header || marked ? INK : BODY);
      const room = bottom - lineY;
      const textWidth = lineWidth(width, marked);
      const need = doc.heightOfString(text, { width: textWidth, lineGap: 1 });
      doc.text(text, x + 8 + (marked ? 14 : 0), lineY, {
        width: textWidth,
        height: Math.min(need, room),
        lineGap: 1,
        ellipsis: need > room,
        ...(isLink ? { link: trimmed, underline: true } : {}),
      });
      lineY += Math.min(need, room);
    });
    x += width;
  });
}

export function twoCol(labelWidth = 170): number[] {
  return [labelWidth, CONTENT_W - labelWidth];
}

export function adRows(ads: AdDraft[]): string[][] {
  return ads.map((ad, index) => [
    String(index + 1),
    [
      ad.title,
      ad.title2,
      ad.text,
      `${ad.title.length} / ${AD_LIMITS.title} · ${ad.title2.length} / ${AD_LIMITS.title2} · ${ad.text.length} / ${AD_LIMITS.text}`,
      ad.basis,
    ].join("\n"),
  ]);
}
