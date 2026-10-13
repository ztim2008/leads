import { callOpenRouter } from "@/lib/ai/openrouter";
import type { PageSnapshot } from "@/lib/briefs/fetch-site";
import { FINDING_KINDS, type FindingKind } from "@/lib/briefs/sections";

export type DraftFinding = {
  kind: FindingKind;
  title: string;
  body: string;
  evidenceUrl: string;
  evidenceQuote: string;
};

const SYSTEM = `Ты разбираешь уже собранные страницы сайта, чтобы директолог понял, что брать в Яндекс.Директ, а разработчик — что мешает на самой странице.
Ответь строго JSON без markdown:
{"findings":[{"kind":"hypothesis|recommendation","title":"коротко","body":"1-3 предложения: сначала что видно на странице, потом одно действие","evidenceUrl":"url из входных страниц","evidenceQuote":"точная цитата из textExcerpt, title или h1 этой страницы"}]}

Правила:
- Не выдумывай показы, ставки, бюджет, конверсию, позиции и число конкурентов.
- Не пиши kind=fact: факты уже собраны кодом.
- hypothesis — что надо проверить. recommendation — что хорошо опереть на страницу или что на ней мешает и как поправить.
- evidenceUrl и evidenceQuote обязательны и должны быть из входных данных.
- 4–8 пунктов. Язык — русский.`;

function parseJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/, "");
  return JSON.parse(trimmed);
}

function quoteOnPage(quote: string, page: PageSnapshot): boolean {
  const needle = quote.replace(/\s+/g, " ").trim().toLowerCase();
  if (needle.length < 8) return false;
  const hay = [page.title, page.description, page.h1, ...page.headings, page.textExcerpt, ...page.ctas, ...page.prices]
    .join("\n")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return hay.includes(needle);
}

export function acceptModelFindings(raw: unknown, pages: PageSnapshot[]): DraftFinding[] {
  const list = Array.isArray((raw as { findings?: unknown })?.findings)
    ? (raw as { findings: unknown[] }).findings
    : [];
  const byUrl = new Map(pages.map((page) => [page.url, page]));
  const accepted: DraftFinding[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const kind = row.kind === "fact" ? "hypothesis" : row.kind;
    if (!FINDING_KINDS.includes(kind as FindingKind) || kind === "fact") continue;
    const title = String(row.title || "").trim().slice(0, 180);
    const body = String(row.body || "").trim().slice(0, 1200);
    const evidenceUrl = String(row.evidenceUrl || "").trim();
    const evidenceQuote = String(row.evidenceQuote || "").trim().slice(0, 400);
    const page = byUrl.get(evidenceUrl);
    if (!title || !body || !page) continue;
    if (!quoteOnPage(evidenceQuote, page)) continue;
    if (/\b\d[\d\s]{2,}\b/.test(body) && !quoteOnPage(body.match(/\d[\d\s]{2,}/)?.[0] || "", page) && /\d{3,}/.test(body)) {
      const numbers = body.match(/\d[\d\s]{2,}/g) || [];
      const invented = numbers.some((num) => !quoteOnPage(num, page) && !page.textExcerpt.includes(num.replace(/\s/g, "")));
      if (invented && /показ|ставк|бюджет|конверс|запрос/i.test(body)) continue;
    }
    accepted.push({
      kind: kind as FindingKind,
      title,
      body,
      evidenceUrl,
      evidenceQuote,
    });
    if (accepted.length >= 8) break;
  }
  return accepted;
}

export async function interpretSite(input: {
  apiKey: string;
  model: string;
  niche: string;
  regionName: string;
  goal: string;
  pages: PageSnapshot[];
}): Promise<DraftFinding[]> {
  const payload = {
    niche: input.niche,
    region: input.regionName,
    goal: input.goal,
    pages: input.pages.map((page) => ({
      url: page.url,
      status: page.status,
      title: page.title,
      description: page.description,
      h1: page.h1,
      headings: page.headings,
      textExcerpt: page.textExcerpt,
      hasForm: page.hasForm,
      hasViewport: page.hasViewport,
      phones: page.phones,
      prices: page.prices,
      ctas: page.ctas,
    })),
  };
  const content = await callOpenRouter(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify(payload) },
    ],
    { model: input.model, temperature: 0.2, maxTokens: 2500, timeout: 45_000 },
    input.apiKey,
  );
  return acceptModelFindings(parseJson(content), input.pages);
}
