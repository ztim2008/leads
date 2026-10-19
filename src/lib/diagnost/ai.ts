import { readFile } from "node:fs/promises";
import { BUSINESS_LABELS, CATEGORY_LABELS, type AiVision, type BusinessType, type CategoryResult, type Priority, type Signals } from "@/lib/diagnost/types";

export const AI_MODEL = process.env.DIAGNOST_MODEL || "deepseek-flash";

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export function aiAvailable(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}

async function callJson(system: string, user: Part[] | string, maxTokens: number): Promise<Record<string, unknown>> {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY?.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: maxTokens,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`DeepSeek ${response.status}: ${(await response.text().catch(() => "")).slice(0, 200)}`);
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content || "";
  const json = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
  return JSON.parse(json) as Record<string, unknown>;
}

const str = (value: unknown, max = 400): string => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");
const num = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n))) : 5;
};
const obj = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});
const strs = (value: unknown, max = 6): string[] => (Array.isArray(value) ? value.map((item) => str(item, 220)).filter(Boolean).slice(0, max) : []);

const TYPES: BusinessType[] = ["ecommerce", "services", "b2b", "saas", "local", "info", "other"];

async function image(path: string | null | undefined): Promise<Part | null> {
  if (!path) return null;
  try {
    const bytes = await readFile(path);
    return { type: "image_url", image_url: { url: `data:image/jpeg;base64,${bytes.toString("base64")}` } };
  } catch {
    return null;
  }
}

const VISION_SYSTEM = `Ты — опытный директолог и CRO-аналитик. Оцениваешь, готов ли сайт принимать платный трафик из Яндекс.Директа.
Правила:
- Опирайся ТОЛЬКО на присланные скриншоты и факты. Не выдумывай цифры, отзывы, цены и названия, которых нет.
- Цитата (quote) — дословный фрагмент текста со страницы из присланных данных или пустая строка.
- Оценки — целые 0–10, строгие: 10 — эталон, 5 — средне, 2 — плохо.
- Пиши по-русски, коротко, языком бизнеса, без терминов вроде DOM, CLS, canonical.
Ответ — строго JSON по схеме:
{"business":{"type":"ecommerce|services|b2b|saas|local|info|other","niche":"ниша 1–3 слова","audience":"B2C|B2B|B2B и B2C","target_action":"основное целевое действие","traffic_source":"предполагаемый источник трафика","price_expected":true|false},
"offer":{"clarity":0-10,"differentiation":0-10,"what":"что продают","for_whom":"кому","usp":"УТП дословно со страницы или null","conclusion":"1–2 предложения: насколько понятен оффер и чего не хватает","quote":"цитата"},
"first_screen":{"understanding":0-10,"cta":0-10,"trust":0-10,"hierarchy":0-10,"comment":"1–2 предложения про первый экран"},
"ux":{"hierarchy":0-10,"path_to_lead":0-10,"comment":"1–2 предложения: насколько очевиден путь к заявке"}}`;

export async function analyzeVision(signals: Signals, hint: BusinessType | null): Promise<AiVision> {
  const { home, render } = signals;
  const facts = {
    url: signals.finalUrl,
    user_business_type: hint ? BUSINESS_LABELS[hint] : "не указан — определи сам",
    title: home.title,
    description: home.description,
    h1: home.h1s.slice(0, 2),
    h2: home.h2s.slice(0, 12),
    first_screen_text_desktop: render.desktop?.foldText || "",
    first_screen_text_mobile: render.mobile?.foldText || "",
    cta_buttons: home.ctas,
    weak_buttons: home.weakCtas,
    prices: home.prices,
    numbers_in_headings: home.specifics,
    forms: home.forms.count,
    phones: home.phones.length,
    messengers: home.messengers,
    cart: home.cart,
    trust: {
      reviews: home.trust.reviews,
      cases: home.trust.cases,
      guarantee: home.trust.guarantee,
      years: home.trust.years,
      legal: Boolean(home.trust.inn) || home.trust.ogrn,
    },
    page_text: home.text.slice(0, 3500),
  };
  const parts: Part[] = [{ type: "text", text: `Факты страницы (JSON):\n${JSON.stringify(facts)}\n\nПервое изображение — первый экран на компьютере 1440×900, второе — на телефоне 390×844.` }];
  for (const part of [await image(render.desktop?.shot), await image(render.mobile?.shot)]) if (part) parts.push(part);

  const raw = await callJson(VISION_SYSTEM, parts, 1800);
  const business = obj(raw.business);
  const offer = obj(raw.offer);
  const first = obj(raw.first_screen);
  const ux = obj(raw.ux);
  const type = TYPES.includes(business.type as BusinessType) ? (business.type as BusinessType) : "other";
  const quote = str(offer.quote, 200);
  const haystack = `${home.title} ${home.h1s.join(" ")} ${home.h2s.join(" ")} ${home.text} ${render.desktop?.foldText || ""}`.toLowerCase();
  const usp = str(offer.usp, 200);
  return {
    business: {
      type,
      niche: str(business.niche, 60),
      audience: str(business.audience, 30),
      targetAction: str(business.target_action, 80),
      trafficSource: str(business.traffic_source, 80),
      priceExpected: business.price_expected !== false,
    },
    offer: {
      clarity: num(offer.clarity),
      differentiation: num(offer.differentiation),
      what: str(offer.what, 160),
      forWhom: str(offer.for_whom, 160),
      usp: usp && usp !== "null" ? usp : null,
      conclusion: str(offer.conclusion, 400),
      quote: quote && haystack.includes(quote.toLowerCase().slice(0, 40)) ? quote : "",
    },
    firstScreen: {
      understanding: num(first.understanding),
      cta: num(first.cta),
      trust: num(first.trust),
      hierarchy: num(first.hierarchy),
      comment: str(first.comment, 400),
    },
    ux: { hierarchy: num(ux.hierarchy), pathToLead: num(ux.path_to_lead), comment: str(ux.comment, 400) },
  };
}

const SUMMARY_SYSTEM = `Ты — директолог. По готовым результатам аудита пишешь выводы для коллеги и клиента.
Правила: используй ТОЛЬКО переданные баллы и проблемы, не добавляй новых фактов и цифр. По-русски, языком бизнеса, без технических терминов.
Ответ — строго JSON:
{"summary":"executive summary 2–4 предложения: общее состояние, главная проблема, сколько элементов исправить до запуска",
"ads_comment":"2–3 предложения глазами директолога: можно ли запускать и главный риск",
"risks":["3 главных риска для рекламы, коротко"],
"before_launch":["4–6 коротких действий до запуска"]}`;

export async function writeSummary(input: {
  host: string;
  business: string;
  overall: number;
  adReadiness: number;
  verdict: string;
  categories: CategoryResult[];
  priorities: Priority[];
  criticalCount: number;
  strengths: string[];
}): Promise<{ summary: string; comment: string; risks: string[]; beforeLaunch: string[] }> {
  const payload = {
    site: input.host,
    business: input.business,
    website_score: input.overall,
    ad_readiness: input.adReadiness,
    verdict: input.verdict,
    critical_problems: input.criticalCount,
    categories: input.categories.map((c) => ({ name: CATEGORY_LABELS[c.id], score: c.score ?? "нет данных" })),
    top_problems: input.priorities.slice(0, 8).map((p) => ({ title: p.title, severity: p.severity, evidence: p.evidence })),
    strengths: input.strengths,
  };
  const raw = await callJson(SUMMARY_SYSTEM, JSON.stringify(payload), 1200);
  return { summary: str(raw.summary, 900), comment: str(raw.ads_comment, 700), risks: strs(raw.risks, 3), beforeLaunch: strs(raw.before_launch, 6) };
}
