import { slotFinding, type PresentFinding } from "@/lib/briefs/present";

export const SECTIONS_TITLE = "Разделы сайта со ссылками с главной";

const SECTION_ROOTS = /^(katalog|catalog|uslugi|services?|products?|shop|category|categories|produkciya|tovary)$/i;
const NOT_LANDING = /politik|privacy|konfiden|kontakt|contact|o-kompan|about|korzin|cart|login|user|search|blog|news|novost|sitemap|oferta|dostavk|oplat/i;

export type SiteLink = { text: string; url: string };
export type SiteSection = SiteLink & { items: number };

export function siteSections(links: SiteLink[], homeUrl: string): SiteSection[] {
  const host = new URL(homeUrl).hostname.replace(/^www\./, "");
  const paths = new Map<string, SiteLink>();
  for (const link of links) {
    let url: URL;
    try {
      url = new URL(link.url);
    } catch {
      continue;
    }
    if (url.hostname.replace(/^www\./, "") !== host) continue;
    const path = url.pathname.replace(/\/+$/, "");
    if (!path || NOT_LANDING.test(path) || paths.has(path)) continue;
    paths.set(path, { text: link.text, url: url.toString() });
  }
  const all = [...paths.keys()];
  const sections: SiteSection[] = [];
  for (const [path, link] of paths) {
    const parts = path.split("/").filter(Boolean);
    const items = all.filter((other) => other.startsWith(`${path}/`)).length;
    const underRoot = parts.length === 2 && SECTION_ROOTS.test(parts[0]);
    if (!items && !underRoot) continue;
    if (sections.some((section) => path.startsWith(`${new URL(section.url).pathname.replace(/\/+$/, "")}/`))) continue;
    sections.push({ ...link, items });
  }
  return sections.sort((a, b) => b.items - a.items).slice(0, 15);
}

export function sectionsBody(sections: SiteSection[]): string {
  return sections.map((section) => `${section.text} — ${section.url} — ссылок на товары и услуги с главной: ${section.items}`).join("\n");
}

export const LANDING_HEADERS = ["Группа объявлений", "Посадочная · факт", "Что сделать · рекомендация"];
export const LANDING_LEAD =
  "Разделы из меню главной и изученные страницы. Каждый раздел — отдельная группа со своей посадочной. Частоты запросов не считали.";

export type LandingRow = {
  group: string;
  url: string;
  fact: string;
  action: string;
};

export function landingMap(input: { niche: string; regionName: string; findings: PresentFinding[] }): LandingRow[] {
  const studied = studiedPages(input.findings);
  const rows: LandingRow[] = [];
  const sections = parseSections(input.findings);

  for (const section of sections) {
    const page = studied.get(norm(section.url));
    rows.push({
      group: section.text,
      url: section.url,
      fact: page
        ? pageFact(page, section.items)
        : `${countLabel(section.items)} Страницу в этом разборе не открывали.`,
      action: page
        ? page.contact
          ? `Отдельная группа «${section.text}». Вести на этот раздел, не на главную.`
          : `Отдельная группа «${section.text}». На странице нет формы и телефона: добавить до запуска или вести на другую.`
        : `Отдельная группа «${section.text}». Перед запуском открыть раздел и проверить форму и цену.`,
    });
  }

  for (const page of studied.values()) {
    if (rows.some((row) => norm(row.url) === page.key)) continue;
    const path = new URL(page.url).pathname.replace(/\/+$/, "");
    if (NOT_LANDING.test(path)) continue;
    const home = path === "";
    rows.push({
      group: home ? `Общие запросы: ${input.niche}` : page.h1 || path,
      url: page.url,
      fact: pageFact(page, null),
      action: home
        ? "Запросы без товара в тексте вести на главную. Запросы с товаром — на его раздел."
        : page.prices.length
          ? `Запросы про условия и порог заказа вести сюда: цена ${page.prices[0]} написана на странице.`
          : "Можно вести запросы по теме страницы. Цены на ней нет.",
    });
  }

  return rows.slice(0, 16);
}

type StudiedPage = { key: string; url: string; h1: string; prices: string[]; contact: boolean };

function studiedPages(findings: PresentFinding[]): Map<string, StudiedPage> {
  const pages = new Map<string, StudiedPage>();
  const heads = findings.find((finding) => finding.title === "Заголовки изученных страниц");
  for (const line of (heads?.body || "").split("\n").filter(Boolean)) {
    const cut = line.indexOf(": title");
    if (cut < 0) continue;
    const url = line.slice(0, cut);
    const h1 = /H1: (.+?)(?: \(\d+ H1\))?;/.exec(line)?.[1] || "";
    pages.set(norm(url), { key: norm(url), url, h1, prices: [], contact: false });
  }
  const prices = slotFinding(findings, "prices");
  if (prices && !/не найден/i.test(prices.title)) {
    for (const [url, list] of urlLines(prices.body)) {
      const page = pages.get(norm(url));
      if (page) page.prices = list.split(", ").filter(Boolean);
    }
  }
  const contact = slotFinding(findings, "contact");
  if (contact?.title.startsWith("Способы связи")) {
    for (const [url, text] of urlLines(contact.body)) {
      const page = pages.get(norm(url));
      if (page) page.contact = /есть форма|телефон/.test(text);
    }
  }
  return pages;
}

function parseSections(findings: PresentFinding[]): SiteSection[] {
  const fact = findings.find((finding) => finding.title === SECTIONS_TITLE);
  if (!fact) return [];
  return fact.body
    .split("\n")
    .map((line) => /^(.+?) — (https?:\/\/\S+) — [^:]+: (\d+)$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => ({ text: match[1], url: match[2], items: Number(match[3]) }));
}

function urlLines(body: string): [string, string][] {
  return body
    .split("\n")
    .map((line) => /^(https?:\/\/\S+?):\s(.*)$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => [match[1], match[2]]);
}

function pageFact(page: StudiedPage, items: number | null): string {
  return [
    items !== null ? countLabel(items) : "",
    page.h1 ? `H1: «${page.h1}».` : "H1 нет.",
    page.prices.length ? `Цена: ${page.prices.join(", ")}.` : "Цены нет.",
    page.contact ? "Форма или телефон есть." : "Формы и телефона нет.",
  ]
    .filter(Boolean)
    .join(" ");
}

function countLabel(items: number): string {
  if (!items) return "Раздел есть в меню главной.";
  const mod10 = items % 10;
  const mod100 = items % 100;
  const word = mod10 === 1 && mod100 !== 11 ? "ссылка" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "ссылки" : "ссылок";
  return `С главной на товары раздела: ${items} ${word}.`;
}

function norm(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return url;
  }
}
