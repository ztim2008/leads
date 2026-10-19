import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  assertPublicUrl,
  isPrivateIp,
  parseRobots,
  parseSitemap,
  pricesInText,
} from "@/lib/briefs/fetch-site";
import type { InnerPage, PageSignals, Redirect, SiteFilesSignals } from "@/lib/diagnost/types";

const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 15_000;
const MAX_HOPS = 5;
const UA = "Mozilla/5.0 (compatible; KonversusDiagnost/1.0; +https://leads.konversus.ru/diagnost)";

const INNER_HINTS: [RegExp, number][] = [
  [/contact|kontakt/, 0],
  [/about|o-nas|o_nas|kompan|company/, 1],
  [/price|cen|stoim|tarif/, 2],
  [/uslug|service|catalog|katalog/, 3],
  [/otzyv|review|feedback/, 4],
  [/portfolio|keys|case|rabot|proekt/, 5],
];

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

const MESSENGERS: [RegExp, string][] = [
  [/(?:wa\.me|api\.whatsapp\.com|whatsapp:)/i, "WhatsApp"],
  [/(?:t\.me|telegram\.me|tg:\/\/)/i, "Telegram"],
  [/viber:/i, "Viber"],
  [/max\.ru\//i, "MAX"],
  [/vk\.(?:com|me)\/(?:im|write)/i, "VK"],
];

const STRONG_CTA =
  /заявк|заказ|купить|в корзину|оформить|получить|рассчитать|расч[её]т|консультац|позвон|перезвон|записат|запис[ь]|оставить|узнать (?:цену|стоимость)|подобрать|вызвать|отправить|забронир|попробовать|начать|скачать|запросить|оценк|бесплатн/i;
const WEAK_CTA = /^(?:подробнее|узнать больше|читать далее|далее|ещё|еще|смотреть|перейти|больше)$/i;

export async function assertPublicHost(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("Этот адрес проверять нельзя");
    return;
  }
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) throw new Error("Сайт не открывается: у домена нет адреса");
  if (records.some((record) => isPrivateIp(record.address))) throw new Error("Этот адрес проверять нельзя");
}

export function normalizeInputUrl(raw: string): URL {
  const trimmed = raw.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = assertPublicUrl(withScheme);
  if (!url.hostname.includes(".")) throw new Error("Укажите адрес сайта, например example.ru");
  url.hash = "";
  return url;
}

function decode(bytes: Uint8Array, contentType: string): string {
  const head = Buffer.from(bytes.subarray(0, 1000)).toString("latin1");
  const charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1] || /charset=["']?([\w-]+)/i.exec(head)?.[1] || "utf-8";
  const label = /1251/.test(charset.toLowerCase()) ? "windows-1251" : "utf-8";
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
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
  }
  if (total >= MAX_BYTES) await reader.cancel().catch(() => undefined);
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

export type Fetched = { url: string; status: number; body: string; bytes: number; elapsedMs: number; redirects: Redirect[]; contentType: string };

export async function fetchFollow(start: string, accept = "text/html,application/xhtml+xml"): Promise<Fetched> {
  let current = assertPublicUrl(start);
  const redirects: Redirect[] = [];
  const started = Date.now();
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    await assertPublicHost(current.hostname);
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "ru-RU,ru;q=0.9" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`Сайт ответил перенаправлением ${response.status} без адреса`);
      const next = assertPublicUrl(new URL(location, current).toString());
      redirects.push({ from: current.toString(), to: next.toString(), status: response.status });
      current = next;
      continue;
    }
    const bytes = await readLimited(response);
    const contentType = response.headers.get("content-type") || "";
    return {
      url: current.toString(),
      status: response.status,
      body: decode(bytes, contentType),
      bytes: bytes.byteLength,
      elapsedMs: Date.now() - started,
      redirects,
      contentType,
    };
  }
  throw new Error("Слишком много перенаправлений");
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag: string, name: string): string {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return (match?.[2] ?? match?.[3] ?? match?.[4] ?? "").trim();
}

function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) || [];
}

function absolute(href: string, base: string): string | null {
  try {
    const url = new URL(href, base);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function sameSite(a: string, b: string): boolean {
  try {
    return new URL(a).hostname.replace(/^www\./, "") === new URL(b).hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
}

type Anchor = { href: string; text: string };

function anchors(html: string, base: string): Anchor[] {
  const out: Anchor[] = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(match[1], "href");
    if (!href) continue;
    out.push({ href, text: stripTags(match[2]).slice(0, 140) || attr(match[1], "title") || attr(match[1], "aria-label") });
    if (out.length > 600) break;
  }
  return out.map((anchor) => ({ ...anchor, href: /^(tel|mailto|javascript|viber|tg|whatsapp):/i.test(anchor.href) ? anchor.href : absolute(anchor.href, base) || anchor.href }));
}

function validInn(digits: string): boolean {
  const n = digits.split("").map(Number);
  const check = (weights: number[]) => (weights.reduce((sum, w, i) => sum + w * n[i], 0) % 11) % 10;
  if (n.length === 10) return check([2, 4, 10, 3, 5, 9, 4, 6, 8]) === n[9];
  if (n.length === 12) {
    return check([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === n[10] && check([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === n[11];
  }
  return false;
}

function isSearchForm(form: string): boolean {
  const head = /<form\b[^>]*>/i.exec(form)?.[0] || "";
  if (/search|poisk|find/i.test(attr(head, "action")) || /search|poisk/i.test(attr(head, "class")) || /role\s*=\s*["']?search/i.test(head)) return true;
  const fields = tags(form, "input").filter((tag) => !/type\s*=\s*["']?(hidden|submit|button)/i.test(tag));
  return fields.length <= 1 && fields.some((tag) => /type\s*=\s*["']?search|name\s*=\s*["']?(q|s|search|query|text)\b/i.test(tag));
}

export function parseHome(html: string, pageUrl: string): Omit<PageSignals, "status" | "elapsedMs" | "htmlKb"> {
  const metas = tags(html, "meta");
  const metaContent = (re: RegExp) => {
    const tag = metas.find((item) => re.test(item));
    return tag ? attr(tag, "content") : "";
  };
  const title = stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "").slice(0, 300);
  const description = metaContent(/name\s*=\s*["']description["']/i).slice(0, 500);
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => stripTags(m[1]).slice(0, 200)).filter(Boolean);
  const h2s = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => stripTags(m[1]).slice(0, 160)).filter(Boolean).slice(0, 30);
  const canonicalTag = tags(html, "link").find((tag) => /rel\s*=\s*["']?canonical/i.test(tag));
  const canonical = canonicalTag ? absolute(attr(canonicalTag, "href"), pageUrl) || "" : "";
  const text = stripTags(html);
  const lower = text.toLowerCase();
  const links = anchors(html, pageUrl);
  const allHrefs = links.map((link) => link.href).join(" ");

  const buttonTexts = [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)].map((m) => stripTags(m[1]));
  const inputButtons = tags(html, "input")
    .filter((tag) => /type\s*=\s*["']?(submit|button)/i.test(tag))
    .map((tag) => attr(tag, "value"));
  const actionTexts = [...links.map((link) => link.text), ...buttonTexts, ...inputButtons]
    .map((label) => label.replace(/\s+/g, " ").trim())
    .filter((label) => label.length > 1 && label.length < 60);
  const strong = actionTexts.filter((label) => STRONG_CTA.test(label));
  const weak = actionTexts.filter((label) => WEAK_CTA.test(label));

  const forms = [...html.matchAll(/<form\b[\s\S]*?<\/form>/gi)]
    .map((m) => m[0])
    .filter((form) => !isSearchForm(form));
  const fieldCounts = forms.map(
    (form) =>
      (tags(form, "input").filter((tag) => !/type\s*=\s*["']?(hidden|submit|button|checkbox|radio)/i.test(tag)).length) +
      tags(form, "textarea").length +
      tags(form, "select").length,
  );
  const consent = /согласи[ея][^.]{0,60}обработк|персональн[а-я]+ данн|152-фз/i.test(text);

  const phones = [...new Set(links.filter((l) => /^tel:/i.test(l.href)).map((l) => decodeURIComponent(l.href.slice(4)).trim()))].slice(0, 6);
  const emails = [...new Set(links.filter((l) => /^mailto:/i.test(l.href)).map((l) => l.href.slice(7).split("?")[0].trim()))].slice(0, 6);
  const messengers = MESSENGERS.filter(([re]) => re.test(allHrefs)).map(([, name]) => name);

  const linkBy = (re: RegExp) =>
    links.find((link) => (re.test(link.text) || re.test(link.href)) && /^https?:/.test(link.href) && sameSite(link.href, pageUrl))?.href || null;

  const schemaTypes = [
    ...new Set(
      [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((m) =>
        [...m[1].matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((t) => t[1]),
      ),
    ),
    ...[...html.matchAll(/itemtype\s*=\s*["']https?:\/\/schema\.org\/(\w+)/gi)].map((m) => m[1]),
  ].slice(0, 12);

  const innMatch = /ИНН[\s:№]*([0-9]{10,12})\b/i.exec(text);
  const inn = innMatch && validInn(innMatch[1]) ? innMatch[1] : null;
  const yearsMatch = /(\d{1,2}\+?\s*(?:лет|года?)\s+(?:на рынке|опыта|работы|в отрасли))|(?:с\s+(?:19|20)\d{2}\s+года)/i.exec(text);
  const metrikaId =
    /\bym\(\s*(\d{5,})/.exec(html)?.[1] || /mc\.yandex\.ru\/watch\/(\d{5,})/i.exec(html)?.[1] || /yaCounter(\d{5,})/.exec(html)?.[1] || null;

  const firstChunk = [h1s[0] || "", ...h2s.slice(0, 6), text.slice(0, 1200)].join(" ");
  const specifics = [
    ...new Set(
      firstChunk.match(/(?:от\s*)?\d[\d\s]{0,8}(?:₽|руб|%|лет|год|дн|дней|час|мин|м²|м2|шт|проект|клиент|объект|км)[а-я]*/gi) || [],
    ),
  ]
    .map((item) => item.replace(/\s+/g, " ").trim())
    .slice(0, 8);

  const navBlock = /<nav\b[\s\S]*?<\/nav>/i.exec(html)?.[0] || /<header\b[\s\S]*?<\/header>/i.exec(html)?.[0] || "";
  const navLinks = (navBlock.match(/<a\b/gi) || []).length;

  return {
    url: pageUrl,
    title,
    description,
    h1s,
    h2s,
    canonical,
    noindex: metas.some((tag) => /name\s*=\s*["'](?:robots|yandex)["']/i.test(tag) && /noindex/i.test(tag)),
    lang: attr(/<html\b[^>]*>/i.exec(html)?.[0] || "", "lang"),
    viewport: metas.some((tag) => /name\s*=\s*["']viewport["']/i.test(tag)),
    og: metas.some((tag) => /property\s*=\s*["']og:title["']/i.test(tag)),
    schemaTypes,
    images: tags(html, "img").length,
    imagesNoAlt: tags(html, "img").filter((tag) => !/\balt\s*=\s*(["'])\s*[^"'\s][^"']*\1/i.test(tag)).length,
    forms: { count: forms.length, maxFields: fieldCounts.length ? Math.max(...fieldCounts) : 0, consent },
    ctas: [...new Set(strong)].slice(0, 12),
    weakCtas: [...new Set(weak)].slice(0, 6),
    ctaCount: strong.length,
    phones,
    emails,
    messengers,
    prices: pricesInText(text),
    specifics,
    navLinks,
    hasAdvantages: /преимуществ|почему (?:мы|нас|выбирают)|наши плюсы|чем мы отличаемся|выгоды/i.test(h2s.join(" ") + " " + lower.slice(0, 20000)),
    trust: {
      reviews: /отзыв|рекомендац(?:ии|ия) клиент/i.test(lower) || /yandex\.ru\/maps-reviews-widget|reviews-widget|flamp/i.test(html),
      cases: /кейс|портфолио|наши работы|выполненные (?:проекты|работы|объекты)|реализованные проекты/i.test(lower),
      certificates: /сертификат|лицензи|(?:^|[^а-яё])сро(?:[^а-яё]|$)|гост|аккредитац|свидетельств/i.test(lower),
      guarantee: /гаранти/i.test(lower),
      clients: /наши клиенты|нам доверяют|партн[её]ры|работаем с|среди наших клиентов/i.test(lower),
      years: yearsMatch ? yearsMatch[0].trim() : null,
      inn,
      ogrn: /огрн(?:ип)?[\s:№]*\d{13,15}/i.test(text),
      address: /(?:^|[\s,(])(?:ул\.|улица|проспект|пр-т|пр\.|переулок|пер\.|шоссе|наб\.|бульвар|б-р)\s*[А-ЯЁA-Z0-9]/.test(text) || schemaTypes.includes("PostalAddress") || /api-maps\.yandex|yandex\.ru\/map-widget/i.test(html),
      privacyUrl: linkBy(/политик[аи] конфиденциальност|обработк[аи] персональных|privacy|politika|konfidenc/i),
      ofertaUrl: linkBy(/оферт|oferta|offer-agreement|пользовательское соглашение/i),
      aboutUrl: linkBy(/^о (?:нас|компании)$|about|o-nas|o-kompanii/i),
    },
    analytics: {
      metrika: Boolean(metrikaId) || /mc\.yandex\.ru\/metrika/i.test(html),
      metrikaId,
      ga4: /googletagmanager\.com\/gtag\/js\?id=G-|gtag\(\s*['"]config['"]\s*,\s*['"]G-/i.test(html),
      gtm: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/i.test(html),
      vkPixel: /vk\.com\/rtrg|top-fwz1\.mail\.ru.*?vk|VK\.Retargeting/i.test(html),
      topMail: /top-fwz1\.mail\.ru|_tmr\.push/i.test(html),
      calltracking: CALLTRACKING.filter(([re]) => re.test(html)).map(([, name]) => name),
      chats: CHATS.filter(([re]) => re.test(html)).map(([, name]) => name),
      ecommerce: /dataLayer[^;]{0,200}ecommerce|"ecommerce"\s*:|ecommerce\s*:\s*["']dataLayer/i.test(html),
      thanksUrl: links.find((link) => /spasibo|thank|thanks|blagodar/i.test(link.href))?.href || null,
    },
    cart: /в корзину|корзина|add[-_]?to[-_]?cart|оформить заказ/i.test(lower) || /\/cart\b|\/basket\b/i.test(allHrefs),
    text: text.slice(0, 6000),
  };
}

export function pickInner(html: string, pageUrl: string, limit = 5): string[] {
  const picked = new Map<number, string>();
  const rest: string[] = [];
  const seen = new Set<string>([pageUrl.replace(/\/$/, "")]);
  for (const link of anchors(html, pageUrl)) {
    if (!/^https?:/.test(link.href) || !sameSite(link.href, pageUrl)) continue;
    if (/\.(pdf|jpe?g|png|webp|gif|zip|docx?|xlsx?)(\?|$)/i.test(link.href)) continue;
    const key = link.href.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const path = new URL(link.href).pathname.toLowerCase();
    const hint = INNER_HINTS.find(([re]) => re.test(path) || re.test(link.text.toLowerCase()));
    if (hint && !picked.has(hint[1])) picked.set(hint[1], link.href);
    else if (path.split("/").filter(Boolean).length === 1) rest.push(link.href);
  }
  return [...[...picked.entries()].sort((a, b) => a[0] - b[0]).map(([, url]) => url), ...rest].slice(0, limit);
}

export async function readInner(urls: string[]): Promise<InnerPage[]> {
  const out: InnerPage[] = [];
  for (const url of urls) {
    try {
      const page = await fetchFollow(url);
      out.push({
        url: page.url,
        status: page.status,
        title: stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(page.body)?.[1] || "").slice(0, 200),
        h1: stripTags(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(page.body)?.[1] || "").slice(0, 200),
      });
    } catch {
      out.push({ url, status: 0, title: "", h1: "" });
    }
  }
  return out;
}

export async function readFiles(homeUrl: string): Promise<SiteFilesSignals> {
  const origin = new URL(homeUrl).origin;
  const robots: SiteFilesSignals["robots"] = { url: `${origin}/robots.txt`, found: false, blocksYandex: false, sitemaps: [] };
  try {
    const file = await fetchFollow(robots.url, "text/plain,*/*");
    robots.found = file.status === 200 && !/<html\b/i.test(file.body.slice(0, 2000));
    if (robots.found) Object.assign(robots, parseRobots(file.body));
  } catch {
    /* файла нет — так и запишем */
  }
  const sitemap: SiteFilesSignals["sitemap"] = { url: robots.sitemaps[0] || `${origin}/sitemap.xml`, found: false, locs: 0, foreignHosts: [] };
  try {
    const file = await fetchFollow(sitemap.url, "application/xml,text/xml,*/*");
    sitemap.found = file.status === 200 && /<(urlset|sitemapindex)\b/i.test(file.body);
    if (sitemap.found) {
      const parsed = parseSitemap(file.body, homeUrl);
      sitemap.locs = parsed.locs;
      sitemap.foreignHosts = parsed.foreignHosts;
    }
  } catch {
    /* файла нет */
  }
  return { robots, sitemap };
}
