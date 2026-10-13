import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { SECTIONS_TITLE, sectionsBody, siteSections, type SiteLink } from "@/lib/briefs/landing";

const MAX_BYTES = 1_200_000;
const TIMEOUT_MS = 12_000;
const MAX_HOPS = 3;
const MAX_PAGES = 5;

const PAGE_HINTS = [
  "price",
  "cen",
  "stoim",
  "uslug",
  "service",
  "catalog",
  "katalog",
  "contact",
  "kontak",
  "about",
  "kompan",
  "zayav",
];

export type PageSnapshot = {
  url: string;
  status: number;
  title: string;
  description: string;
  h1: string;
  headings: string[];
  textExcerpt: string;
  hasForm: boolean;
  hasViewport: boolean;
  phones: string[];
  emails: string[];
  prices: string[];
  ctas: string[];
  elapsedMs: number;
  h1Count?: number;
  images?: number;
  imagesWithoutAlt?: number;
  noindex?: boolean;
  canonical?: string;
  metrikaId?: string | null;
  metrika?: boolean;
  gtm?: boolean;
  calltracking?: string[];
  chats?: string[];
  links?: SiteLink[];
};

export type SiteFiles = {
  robots: { url: string; status: number; found: boolean; blocksYandex: boolean; sitemaps: string[] };
  sitemap: { url: string; status: number; found: boolean; index: boolean; locs: number; foreignHosts: string[] };
};

const CALLTRACKING: [RegExp, string][] = [
  [/calltouch/i, "Calltouch"],
  [/roistat/i, "Roistat"],
  [/comagic|uiscom/i, "CoMagic / UIS"],
  [/callibri/i, "Callibri"],
  [/alloka/i, "Alloka"],
  [/mango-office\.ru\/(?:calltracking|widgets)/i, "Mango Office"],
];

const CHATS: [RegExp, string][] = [
  [/jivosite|code\.jivo|jivo\.ru/i, "Jivo"],
  [/bitrix24\.[a-z]+\/b\d+|crm\.site\.button|b24-widget/i, "Битрикс24"],
  [/envybox/i, "Envybox"],
  [/callbackhunter/i, "CallbackHunter"],
  [/talk-me/i, "Talk-Me"],
  [/livetex/i, "LiveTex"],
  [/redconnect/i, "RedConnect"],
];

export function isPrivateIp(ip: string): boolean {
  const value = ip.toLowerCase().replace(/^::ffff:/, "");
  if (value === "::1" || value === "0.0.0.0") return true;
  if (value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
  if (!isIP(value)) return true;
  if (value.includes(":")) return false;
  const [a, b] = value.split(".").map((part) => Number(part));
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Адрес сайта не разбирается");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Нужен адрес http или https");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    throw new Error("Этот адрес читать нельзя");
  }
  if (isIP(host) && isPrivateIp(host)) throw new Error("Этот адрес читать нельзя");
  return url;
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("Этот адрес читать нельзя");
    return;
  }
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) throw new Error("Сайт не открывается: нет адреса");
  if (records.some((record) => isPrivateIp(record.address))) {
    throw new Error("Этот адрес читать нельзя");
  }
}

function decodeHtml(bytes: Uint8Array, contentType: string): string {
  const head = Buffer.from(bytes.subarray(0, 800)).toString("latin1");
  const charset =
    /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ||
    /charset=["']?([\w-]+)/i.exec(head)?.[1] ||
    "utf-8";
  const label = charset.toLowerCase() === "windows-1251" ? "windows-1251" : "utf-8";
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag: string, name: string): string {
  const match = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return (match?.[2] || match?.[3] || match?.[4] || "").trim();
}

function collectTags(html: string, tagName: string): string[] {
  const re = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  return html.match(re) || [];
}

export function parsePage(html: string, pageUrl: string): Omit<PageSnapshot, "status" | "elapsedMs"> {
  const title = stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "");
  const descriptionTag = collectTags(html, "meta").find((tag) =>
    /name\s*=\s*["']description["']/i.test(tag),
  );
  const description = descriptionTag ? attr(descriptionTag, "content") : "";
  const h1 = stripTags(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] || "").slice(0, 300);
  const headings = [...html.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
    .slice(0, 12);
  const text = stripTags(html);
  const textExcerpt = text.slice(0, 2500);
  const phones = [
    ...new Set(
      [...html.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)].map((match) =>
        decodeURIComponent(match[1]).trim(),
      ),
    ),
  ].slice(0, 6);
  const emails = [
    ...new Set(
      [...html.matchAll(/href\s*=\s*["']mailto:([^"'?]+)/gi)].map((match) => match[1].trim()),
    ),
  ].slice(0, 6);
  const prices = pricesInText(text);
  const ctas = [
    ...new Set(
      [...html.matchAll(/<(?:a|button)\b[^>]*>([\s\S]*?)<\/(?:a|button)>/gi)]
        .map((match) => stripTags(match[1]))
        .filter((label) =>
          /расч[её]т|заявк|заказа|позвон|консультац|купить|оставить|получить|перезвон/i.test(label),
        ),
    ),
  ].slice(0, 8);
  return {
    url: pageUrl,
    title: title.slice(0, 300),
    description: description.slice(0, 400),
    h1,
    headings,
    textExcerpt,
    hasForm: /<form\b/i.test(html),
    hasViewport: collectTags(html, "meta").some((tag) => /name\s*=\s*["']viewport["']/i.test(tag)),
    phones,
    emails,
    prices,
    ctas,
    h1Count: [...html.matchAll(/<h1\b/gi)].length,
    images: [...html.matchAll(/<img\b[^>]*>/gi)].length,
    imagesWithoutAlt: [...html.matchAll(/<img\b[^>]*>/gi)].filter((match) => !/\balt\s*=\s*(["'])[^"']+\1/i.test(match[0])).length,
    noindex: collectTags(html, "meta").some((tag) => /robots/i.test(tag) && /noindex/i.test(tag)),
    canonical: canonicalOf(html, pageUrl),
    metrikaId: metrikaIdOf(html),
    metrika: Boolean(metrikaIdOf(html)) || /mc\.yandex\.ru\/metrika/i.test(html),
    gtm: /googletagmanager\.com\/gtm\.js/i.test(html),
    calltracking: CALLTRACKING.filter(([re]) => re.test(html)).map(([, name]) => name),
    chats: CHATS.filter(([re]) => re.test(html)).map(([, name]) => name),
    links: linksOf(html, pageUrl),
  };
}

function linksOf(html: string, pageUrl: string): SiteLink[] {
  const base = new URL(pageUrl);
  const seen = new Set<string>();
  const out: SiteLink[] = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(match[1], "href");
    const text = stripTags(match[2]).slice(0, 120);
    if (!href || !text || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) continue;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
    url.hash = "";
    const key = url.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text, url: key });
    if (out.length >= 150) break;
  }
  return out;
}

function canonicalOf(html: string, pageUrl: string): string {
  const tag = collectTags(html, "link").find((item) => /rel\s*=\s*["']?canonical/i.test(item));
  const href = tag ? attr(tag, "href") : "";
  if (!href) return "";
  try {
    return new URL(href, pageUrl).toString();
  } catch {
    return href;
  }
}

function metrikaIdOf(html: string): string | null {
  return (
    /\bym\(\s*(\d{5,})/.exec(html)?.[1] ||
    /mc\.yandex\.ru\/watch\/(\d{5,})/i.exec(html)?.[1] ||
    /yaCounter(\d{5,})/.exec(html)?.[1] ||
    null
  );
}

export function sameUrl(a: string, b: string): boolean {
  const norm = (value: string) => {
    try {
      const url = new URL(value);
      url.hash = "";
      return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}${url.search}`;
    } catch {
      return value;
    }
  };
  return norm(a) === norm(b);
}

export function parseRobots(text: string): { blocksYandex: boolean; sitemaps: string[] } {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  const sitemaps: string[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (current && (key === "allow" || key === "disallow")) {
      current.rules.push({ allow: key === "allow", path: value });
    }
  }
  const group =
    groups.find((item) => item.agents.some((agent) => agent === "yandex")) ||
    groups.find((item) => item.agents.includes("*"));
  const blocksYandex = Boolean(
    group &&
      group.rules.some((rule) => !rule.allow && rule.path === "/") &&
      !group.rules.some((rule) => rule.allow && rule.path === "/"),
  );
  return { blocksYandex, sitemaps };
}

export function parseSitemap(xml: string, siteUrl: string): { index: boolean; locs: number; foreignHosts: string[] } {
  const host = new URL(siteUrl).hostname.replace(/^www\./, "");
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((match) => match[1]);
  const foreign = new Set<string>();
  for (const loc of locs) {
    try {
      const other = new URL(loc, siteUrl).hostname.replace(/^www\./, "");
      if (other !== host) foreign.add(other);
    } catch {
      continue;
    }
  }
  return { index: /<sitemapindex\b/i.test(xml), locs: locs.length, foreignHosts: [...foreign].slice(0, 5) };
}

export function pricesInText(text: string): string[] {
  return [
    ...new Set(
      text.match(/\d[\d\s]{0,14}(?:\s*(?:₽|руб\.?)|\s*[рР]\.?(?![а-яёa-z]))/gi) || [],
    ),
  ]
    .map((item) => item.replace(/\s+/g, " ").trim())
    .slice(0, 8);
}

export function pickInternalLinks(html: string, pageUrl: string): string[] {
  const base = new URL(pageUrl);
  const seen = new Set<string>();
  const found: { url: string; score: number; depth: number }[] = [];
  for (const tag of collectTags(html, "a")) {
    const href = attr(tag, "href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    let next: URL;
    try {
      next = new URL(href, base);
    } catch {
      continue;
    }
    if (next.hostname !== base.hostname) continue;
    if (!/^https?:$/.test(next.protocol)) continue;
    next.hash = "";
    const key = next.toString();
    if (seen.has(key) || key === base.toString()) continue;
    seen.add(key);
    const path = next.pathname.toLowerCase();
    const score = PAGE_HINTS.findIndex((hint) => path.includes(hint));
    found.push({ url: key, score: score === -1 ? 50 : score, depth: path.split("/").filter(Boolean).length });
  }
  found.sort((a, b) => a.score - b.score || a.depth - b.depth);
  const perHint = new Map<number, number>();
  const picked: string[] = [];
  const rest: string[] = [];
  for (const item of found) {
    const taken = perHint.get(item.score) || 0;
    if (item.score !== 50 && taken >= 2) {
      rest.push(item.url);
      continue;
    }
    perHint.set(item.score, taken + 1);
    picked.push(item.url);
  }
  return [...picked, ...rest].slice(0, MAX_PAGES - 1);
}

async function readLimited(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.byteLength;
    if (total >= MAX_BYTES) {
      await reader.cancel();
      break;
    }
  }
  const out = new Uint8Array(Math.min(total, MAX_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const slice = chunk.subarray(0, out.length - offset);
    out.set(slice, offset);
    offset += slice.byteLength;
    if (offset >= out.length) break;
  }
  return out;
}

async function fetchHtml(start: string): Promise<{ url: string; status: number; html: string; elapsedMs: number }> {
  return fetchResource(start, "html");
}

async function fetchResource(
  start: string,
  kind: "html" | "text",
): Promise<{ url: string; status: number; html: string; elapsedMs: number }> {
  let current = assertPublicUrl(start);
  const started = Date.now();
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    await assertPublicHost(current.hostname);
    const response = await fetch(current, {
      redirect: "manual",
      headers: {
        "User-Agent": "KonversusBriefs/1.0 (+https://leads.konversus.ru)",
        Accept: kind === "html" ? "text/html,application/xhtml+xml" : "text/plain,application/xml,text/xml",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`Сайт ответил перенаправлением ${response.status} без адреса`);
      current = assertPublicUrl(new URL(location, current).toString());
      continue;
    }
    const type = response.headers.get("content-type") || "";
    if (kind === "html" && type && !/text\/html|application\/xhtml/i.test(type)) {
      throw new Error("Адрес открылся, но это не HTML-страница");
    }
    const bytes = await readLimited(response);
    return {
      url: current.toString(),
      status: response.status,
      html: decodeHtml(bytes, type),
      elapsedMs: Date.now() - started,
    };
  }
  throw new Error("Слишком много перенаправлений");
}

export async function readSite(rawUrl: string): Promise<PageSnapshot[]> {
  const home = await fetchHtml(rawUrl);
  const homeParsed = parsePage(home.html, home.url);
  const pages: PageSnapshot[] = [
    { ...homeParsed, status: home.status, elapsedMs: home.elapsedMs },
  ];
  if (home.status >= 400) return pages;
  const links = pickInternalLinks(home.html, home.url);
  for (const link of links) {
    if (pages.length >= MAX_PAGES) break;
    try {
      const page = await fetchHtml(link);
      const { links: _links, ...parsed } = parsePage(page.html, page.url);
      pages.push({ ...parsed, status: page.status, elapsedMs: page.elapsedMs });
    } catch (error) {
      pages.push({
        url: link,
        status: 0,
        title: "",
        description: "",
        h1: "",
        headings: [],
        textExcerpt: error instanceof Error ? error.message : "Страница не открылась",
        hasForm: false,
        hasViewport: false,
        phones: [],
        emails: [],
        prices: [],
        ctas: [],
        elapsedMs: 0,
      });
    }
  }
  return pages;
}

export async function readSiteFiles(homeUrl: string): Promise<SiteFiles> {
  const origin = new URL(homeUrl).origin;
  const robotsUrl = `${origin}/robots.txt`;
  const robots: SiteFiles["robots"] = { url: robotsUrl, status: 0, found: false, blocksYandex: false, sitemaps: [] };
  try {
    const file = await fetchResource(robotsUrl, "text");
    robots.status = file.status;
    robots.found = file.status === 200 && !/<html\b/i.test(file.html.slice(0, 2000));
    if (robots.found) Object.assign(robots, parseRobots(file.html));
  } catch {
    robots.status = 0;
  }
  const sitemapUrl = robots.sitemaps[0] || `${origin}/sitemap.xml`;
  const sitemap: SiteFiles["sitemap"] = { url: sitemapUrl, status: 0, found: false, index: false, locs: 0, foreignHosts: [] };
  try {
    const file = await fetchResource(sitemapUrl, "text");
    sitemap.status = file.status;
    sitemap.found = file.status === 200 && /<(urlset|sitemapindex)\b/i.test(file.html);
    if (sitemap.found) Object.assign(sitemap, parseSitemap(file.html, homeUrl));
  } catch {
    sitemap.status = 0;
  }
  return { robots, sitemap };
}

export function factsFromSiteFiles(files: SiteFiles): Array<{
  kind: "fact";
  title: string;
  body: string;
  evidenceUrl: string;
  evidenceQuote: string;
}> {
  const { robots, sitemap } = files;
  const robotsFact = !robots.found
    ? {
        title: "robots.txt не найден",
        body: robots.status ? `Сервер ответил кодом ${robots.status}.` : "Файл не открылся.",
      }
    : robots.blocksYandex
      ? {
          title: "robots.txt закрывает сайт от Яндекса",
          body: "Для Яндекса или для всех роботов стоит Disallow: /.",
        }
      : {
          title: "robots.txt найден, сайт от Яндекса не закрыт",
          body: robots.sitemaps.length
            ? `Строка Sitemap: ${robots.sitemaps.join(", ")}.`
            : "Строки Sitemap в файле нет.",
        };
  const sitemapFact = !sitemap.found
    ? {
        title: "sitemap.xml не найден",
        body: sitemap.status ? `${sitemap.url}: код ${sitemap.status}.` : `${sitemap.url} не открылся.`,
      }
    : sitemap.foreignHosts.length
      ? {
          title: "sitemap.xml ведёт на чужой домен",
          body: `Адресов: ${sitemap.locs}. Чужие домены: ${sitemap.foreignHosts.join(", ")}.`,
        }
      : {
          title: `sitemap.xml найден: ${sitemap.locs} ${sitemap.index ? "файлов карты" : "адресов"}`,
          body: `${sitemap.url}${sitemap.index ? " — это индекс из нескольких карт." : ""}`,
        };
  return [
    { kind: "fact", ...robotsFact, evidenceUrl: robots.url, evidenceQuote: robots.url },
    { kind: "fact", ...sitemapFact, evidenceUrl: sitemap.url, evidenceQuote: sitemap.url },
  ];
}

export function factsFromPages(pages: PageSnapshot[]): Array<{
  kind: "fact";
  title: string;
  body: string;
  evidenceUrl: string;
  evidenceQuote: string;
}> {
  const home = pages[0];
  if (!home) return [];
  const facts: Array<{
    kind: "fact";
    title: string;
    body: string;
    evidenceUrl: string;
    evidenceQuote: string;
  }> = [];
  facts.push({
    kind: "fact",
    title: home.status >= 400 ? "Главная страница не открылась" : "Главная страница открылась",
    body:
      home.status >= 400
        ? `Сервер ответил кодом ${home.status}.`
        : `Ответ ${home.status}, загрузка HTML заняла ${home.elapsedMs} мс. Это время ответа сервера, не оценка скорости у посетителя.`,
    evidenceUrl: home.url,
    evidenceQuote: home.title || home.h1 || home.url,
  });
  if (home.h1 || home.title) {
    facts.push({
      kind: "fact",
      title: "Как страница называет предложение",
      body: [home.h1 && `Заголовок H1: ${home.h1}`, home.title && `Title: ${home.title}`, home.description && `Описание: ${home.description}`]
        .filter(Boolean)
        .join("\n"),
      evidenceUrl: home.url,
      evidenceQuote: home.h1 || home.title,
    });
  }
  const priced = pages.filter((page) => page.prices.length > 0);
  if (priced.length) {
    facts.push({
      kind: "fact",
      title: "На изученных страницах есть цены",
      body: priced.map((page) => `${page.url}: ${page.prices.join(", ")}`).join("\n"),
      evidenceUrl: priced[0].url,
      evidenceQuote: priced[0].prices[0],
    });
  } else {
    facts.push({
      kind: "fact",
      title: "Цены на изученных страницах не найдены",
      body: `Проверены страницы: ${pages.map((page) => page.url).join(", ")}. Фразы с суммой в рублях в тексте не встретились.`,
      evidenceUrl: home.url,
      evidenceQuote: home.title || home.url,
    });
  }
  const withContact = pages.filter((page) => page.hasForm || page.phones.length || page.emails.length || page.ctas.length);
  facts.push({
    kind: "fact",
    title: withContact.length ? "Способы связи на изученных страницах" : "Форма и телефон на изученных страницах не найдены",
    body: withContact.length
      ? withContact
          .map((page) => {
            const bits = [
              page.hasForm ? "есть форма" : "",
              page.phones.length ? `телефон: ${page.phones.join(", ")}` : "",
              page.emails.length ? `почта: ${page.emails.join(", ")}` : "",
              page.ctas.length ? `кнопки: ${page.ctas.join("; ")}` : "",
            ].filter(Boolean);
            return `${page.url}: ${bits.join("; ")}`;
          })
          .join("\n")
      : "В HTML изученных страниц нет формы, ссылки tel:, mailto: и кнопок с просьбой оставить заявку.",
    evidenceUrl: (withContact[0] || home).url,
    evidenceQuote: withContact[0]?.ctas[0] || withContact[0]?.phones[0] || home.title || home.url,
  });
  const withoutViewport = pages.filter((page) => page.status > 0 && page.status < 400 && !page.hasViewport);
  facts.push({
    kind: "fact",
    title: withoutViewport.length ? "На части страниц нет метки viewport" : "На изученных страницах есть метка viewport",
    body: withoutViewport.length
      ? `Без viewport: ${withoutViewport.map((page) => page.url).join(", ")}. Это не проверка удобства с телефона, только наличие мета-тега.`
      : "Мета-тег viewport есть. Это не проверка удобства формы с телефона.",
    evidenceUrl: (withoutViewport[0] || home).url,
    evidenceQuote: (withoutViewport[0] || home).title || (withoutViewport[0] || home).url,
  });
  const opened = pages.filter((page) => page.status > 0 && page.status < 400);
  if (opened.length) {
    facts.push({
      kind: "fact",
      title: "Заголовки изученных страниц",
      body: opened
        .map((page) => {
          const h1 = page.h1 ? `H1: ${page.h1}` : "H1 нет";
          const extra = (page.h1Count || 0) > 1 ? ` (${page.h1Count} H1)` : "";
          const description = page.description ? `описание ${page.description.length} знаков` : "описания нет";
          return `${page.url}: title ${page.title.length} знаков; ${h1}${extra}; ${description}`;
        })
        .join("\n"),
      evidenceUrl: home.url,
      evidenceQuote: home.title || home.url,
    });
  }
  const images = opened.reduce((sum, page) => sum + (page.images || 0), 0);
  const bare = opened.reduce((sum, page) => sum + (page.imagesWithoutAlt || 0), 0);
  if (images > 0) {
    facts.push({
      kind: "fact",
      title: bare ? `Картинки без подписи alt: ${bare} из ${images}` : "У картинок на изученных страницах есть alt",
      body: bare
        ? "Подпись alt пустая или её нет. Это видно в HTML, без оценки позиций."
        : "У найденных картинок атрибут alt заполнен.",
      evidenceUrl: home.url,
      evidenceQuote: home.title || home.url,
    });
  }
  const hidden = opened.filter((page) => page.noindex);
  facts.push({
    kind: "fact",
    title: hidden.length ? "На части страниц стоит noindex" : "Меток noindex на изученных страницах нет",
    body: hidden.length
      ? `noindex: ${hidden.map((page) => page.url).join(", ")}.`
      : "В мета-теге robots изученных страниц noindex не найден.",
    evidenceUrl: (hidden[0] || home).url,
    evidenceQuote: (hidden[0] || home).title || (hidden[0] || home).url,
  });

  const sections = home.links?.length ? siteSections(home.links, home.url) : [];
  if (sections.length) {
    facts.push({
      kind: "fact",
      title: SECTIONS_TITLE,
      body: sectionsBody(sections),
      evidenceUrl: home.url,
      evidenceQuote: sections[0].text,
    });
  }

  if (opened.length) {
    const counted = opened.filter((page) => page.metrika);
    const ids = [...new Set(counted.map((page) => page.metrikaId).filter(Boolean))];
    const missing = opened.filter((page) => !page.metrika);
    facts.push(
      counted.length
        ? {
            kind: "fact",
            title: "Счётчик Яндекс.Метрики найден",
            body: [
              ids.length ? `Номер счётчика: ${ids.join(", ")}.` : "Код Метрики есть, номер в HTML не найден.",
              `Есть на ${counted.length} из ${opened.length} изученных страниц.`,
              missing.length ? `Нет на ${missing.map((page) => page.url).join(", ")}.` : "",
              "Цели в HTML не видны, их смотрят в самой Метрике.",
            ]
              .filter(Boolean)
              .join(" "),
            evidenceUrl: counted[0].url,
            evidenceQuote: ids[0] || "mc.yandex.ru",
          }
        : {
            kind: "fact",
            title: "Счётчик Яндекс.Метрики в HTML не найден",
            body: opened.some((page) => page.gtm)
              ? "Кода Метрики в HTML нет, но есть Google Tag Manager: счётчик мог подключаться через него."
              : "На изученных страницах нет кода mc.yandex.ru и вызова ym().",
            evidenceUrl: home.url,
            evidenceQuote: home.title || home.url,
          },
    );

    const tracking = [...new Set(opened.flatMap((page) => page.calltracking || []))];
    const chats = [...new Set(opened.flatMap((page) => page.chats || []))];
    facts.push({
      kind: "fact",
      title: tracking.length || chats.length ? "Коллтрекинг и чат на сайте" : "Коллтрекинг и онлайн-чат не найдены",
      body:
        tracking.length || chats.length
          ? [
              tracking.length ? `Коллтрекинг: ${tracking.join(", ")}.` : "Коллтрекинга нет.",
              chats.length ? `Чат или обратный звонок: ${chats.join(", ")}.` : "Чата нет.",
            ].join(" ")
          : "Кодов Calltouch, Roistat, CoMagic, Callibri, Jivo, Битрикс24 и подобных в HTML изученных страниц нет.",
      evidenceUrl: home.url,
      evidenceQuote: home.title || home.url,
    });

    const noCanonical = opened.filter((page) => page.canonical === "");
    const elsewhere = opened.filter((page) => page.canonical && !sameUrl(page.canonical, page.url));
    const known = opened.filter((page) => page.canonical !== undefined);
    if (known.length) {
      facts.push({
        kind: "fact",
        title: elsewhere.length
          ? "Canonical ведёт на другой адрес"
          : noCanonical.length
            ? "Canonical есть не на всех страницах"
            : "Canonical указывает на саму страницу",
        body:
          [
            elsewhere.map((page) => `${page.url} → ${page.canonical}`).join("\n"),
            noCanonical.length ? `Без canonical: ${noCanonical.map((page) => page.url).join(", ")}.` : "",
          ]
            .filter(Boolean)
            .join("\n") || `На всех ${known.length} изученных страницах canonical совпадает с адресом.`,
        evidenceUrl: (elsewhere[0] || noCanonical[0] || home).url,
        evidenceQuote: (elsewhere[0] || noCanonical[0] || home).title || home.url,
      });
    }

    if (opened.length > 1) {
      const byTitle = new Map<string, string[]>();
      for (const page of opened) {
        const key = page.title.trim().toLowerCase();
        if (!key) continue;
        byTitle.set(key, [...(byTitle.get(key) || []), page.url]);
      }
      const dupes = [...byTitle.entries()].filter(([, urls]) => urls.length > 1);
      facts.push({
        kind: "fact",
        title: dupes.length ? "Одинаковый title на нескольких страницах" : "Title изученных страниц разные",
        body: dupes.length
          ? dupes
              .map(([, urls]) => {
                const title = opened.find((page) => page.url === urls[0])?.title || "";
                return `«${title}»: ${urls.join(", ")}`;
              })
              .join("\n")
          : `Повторов title на ${opened.length} изученных страницах нет.`,
        evidenceUrl: home.url,
        evidenceQuote: home.title || home.url,
      });
    }
  }
  return facts;
}
