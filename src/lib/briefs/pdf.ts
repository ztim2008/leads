import { existsSync } from "fs";
import PDFDocument from "pdfkit";
import { AD_LIMITS, type AdDraft } from "@/lib/briefs/ads";

const PAGE: [number, number] = [520, 760];
const MARGIN = 28;
const CONTENT_W = PAGE[0] - MARGIN * 2;

/** Светлые токены из globals.css :root — документ читают на белом фоне в мессенджере. */
const INK = "#0f172a";
const BODY = "#1e293b";
const MUTED = "#64748b";
const LINE = "#e5e7eb";
const HEAD = "#f8f9fa";
const PAPER = "#ffffff";

const REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

export type PdfTable = {
  title: string;
  headers: string[];
  rows: string[][];
  widths: number[];
};

export type BriefPdf = {
  company: string;
  siteUrl: string;
  intro: string;
  tables: PdfTable[];
  notes: string;
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

  ensure(78);
  doc.font("regular").fontSize(10).fillColor(MUTED).text("Konversus · Стратег", MARGIN, y, { width: CONTENT_W });
  y += 16;
  doc.font("bold").fontSize(18).fillColor(INK).text(input.company, MARGIN, y, { width: CONTENT_W });
  y = doc.y + 4;
  doc.font("regular").fontSize(11).fillColor(BODY).text(input.siteUrl, MARGIN, y, { width: CONTENT_W });
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

  drawFooter(doc, pageNumber);
  doc.end();
  return done;

  function drawFooter(current: PDFKit.PDFDocument, page: number) {
    const cursor = current.y;
    current.font("regular").fontSize(9).fillColor(MUTED).text(String(page), MARGIN, PAGE[1] - 16, {
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
  const headerHeight = rowHeight(doc, table.headers, table.widths, true);
  const firstHeight = Math.min(
    rowHeight(doc, padRow(rows[0], table.headers.length), table.widths, false),
    PAGE[1] - MARGIN * 2 - 80,
  );
  let y = startY;
  if (y + 28 + headerHeight + firstHeight > PAGE[1] - MARGIN - 18) {
    nextPage();
    y = MARGIN;
  }
  doc.font("bold").fontSize(14).fillColor(INK).text(table.title, MARGIN, y, { width: CONTENT_W });
  y = doc.y + 8;

  const paintHeader = () => {
    const height = rowHeight(doc, table.headers, table.widths, true);
    if (y + height > PAGE[1] - MARGIN - 18) {
      nextPage();
      y = MARGIN;
    }
    paintRow(doc, table.headers, table.widths, y, height, true);
    y += height;
  };

  paintHeader();
  for (const row of rows) {
    const cells = padRow(row, table.headers.length);
    const height = Math.min(rowHeight(doc, cells, table.widths, false), PAGE[1] - MARGIN * 2 - 36);
    if (y + height > PAGE[1] - MARGIN - 18) {
      nextPage();
      y = MARGIN;
      paintHeader();
    }
    paintRow(doc, cells, table.widths, y, height, false);
    y += height;
  }
  return y + 16;
}

function padRow(row: string[], count: number): string[] {
  const cells = row.slice(0, count);
  while (cells.length < count) cells.push("");
  return cells;
}

function rowHeight(doc: PDFKit.PDFDocument, cells: string[], widths: number[], header: boolean): number {
  doc.font(header ? "bold" : "regular").fontSize(header ? 10 : 11);
  const textHeight = Math.max(
    ...cells.map((cell, index) => doc.heightOfString(cell || " ", { width: widths[index] - 16, lineGap: 1 })),
  );
  return Math.max(28, textHeight + 14);
}

function paintRow(
  doc: PDFKit.PDFDocument,
  cells: string[],
  widths: number[],
  y: number,
  height: number,
  header: boolean,
) {
  let x = MARGIN;
  cells.forEach((cell, index) => {
    const width = widths[index];
    doc.save();
    doc.rect(x, y, width, height).fill(header ? HEAD : PAPER);
    doc.restore();
    doc.lineWidth(0.6).strokeColor(LINE).rect(x, y, width, height).stroke();
    doc
      .font(header ? "bold" : "regular")
      .fontSize(header ? 10 : 11)
      .fillColor(header ? INK : BODY)
      .text(cell || " ", x + 8, y + 7, { width: width - 16, height: height - 12, lineGap: 1, ellipsis: true });
    x += width;
  });
}

export function twoCol(labelWidth = 118): number[] {
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
