import { slotFinding, slotSummary, type PresentFinding } from "@/lib/briefs/present";

/** Лимиты текстово-графического объявления Директа. */
export const AD_LIMITS = { title: 56, title2: 30, text: 81 } as const;

export type AdDraft = {
  title: string;
  title2: string;
  text: string;
  basis: string;
};

export function fitAd(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  if (flat.length <= max) return flat;
  const slice = flat.slice(0, max + 1);
  const space = slice.lastIndexOf(" ");
  const cut = space >= Math.floor(max * 0.55) ? slice.slice(0, space) : flat.slice(0, max);
  return cut.trim();
}

export function adsFromFindings(input: {
  company: string;
  niche: string;
  regionName: string;
  goal: string;
  findings: PresentFinding[];
}): AdDraft[] {
  const offer = slotFinding(input.findings, "offer");
  const prices = slotFinding(input.findings, "prices");
  const offerText = offer ? slotSummary(offer, "offer") : "";
  const priceKnown = Boolean(prices && !/не найден/i.test(prices.title));
  const priceText = priceKnown && prices ? slotSummary(prices, "prices") : "";
  const drafts: AdDraft[] = [
    {
      title: fitAd(input.niche || offerText || input.company, AD_LIMITS.title),
      title2: fitAd(input.regionName, AD_LIMITS.title2),
      text: fitAd(offerText || input.goal, AD_LIMITS.text),
      basis: offerText ? "Ниша и регион из брифа. Текст — формулировка со страницы." : "Ниша, регион и цель из брифа. На сайте формулировки не нашлось.",
    },
    {
      title: fitAd(input.company, AD_LIMITS.title),
      title2: fitAd(input.niche, AD_LIMITS.title2),
      text: fitAd(input.goal, AD_LIMITS.text),
      basis: "Название со страницы. Ниша и цель из брифа.",
    },
  ];
  if (priceText) {
    drafts.push({
      title: fitAd(input.niche || input.company, AD_LIMITS.title),
      title2: fitAd("Цена на сайте", AD_LIMITS.title2),
      text: fitAd(priceText, AD_LIMITS.text),
      basis: "Цена взята со страницы, не придумана.",
    });
  }
  return drafts.map((draft) => ({
    ...draft,
    title: draft.title || "Нет данных",
    title2: draft.title2 || "Нет данных",
    text: draft.text || "Нет данных",
  }));
}
