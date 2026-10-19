import { levelOf } from "@/lib/diagnost/levels";
import {
  CATEGORY_WEIGHTS,
  type CategoryId,
  type CategoryResult,
  type Check,
  type Level,
  type Priority,
  type Signals,
  type Verdict,
} from "@/lib/diagnost/types";

const CREDIT = { pass: 1, warn: 0.5, fail: 0 } as const;
const IMPACT: Record<Level, number> = { low: 1, medium: 2, high: 3 };
const EFFORT: Record<Level, number> = { low: 1, medium: 2, high: 3 };

/** Категория без данных, если проверено меньше этой доли веса */
const MIN_KNOWN_SHARE = 0.4;

export function categoryScores(checks: Check[]): CategoryResult[] {
  return (Object.keys(CATEGORY_WEIGHTS) as CategoryId[]).map((id) => {
    const own = checks.filter((item) => item.category === id);
    const weighted = own.filter((item) => item.weight > 0 && item.status !== "info");
    const known = weighted.filter((item) => item.status !== "unknown");
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    const knownWeight = known.reduce((sum, item) => sum + item.weight, 0);
    if (!knownWeight || knownWeight < total * MIN_KNOWN_SHARE) return { id, score: null, level: null, checks: own };
    const got = known.reduce((sum, item) => sum + item.weight * CREDIT[item.status as keyof typeof CREDIT], 0);
    const score = Math.round((got / knownWeight) * 100);
    return { id, score, level: levelOf(score), checks: own };
  });
}

export function overallScore(categories: CategoryResult[]): number {
  let sum = 0;
  let weight = 0;
  for (const category of categories) {
    if (category.score === null) continue;
    sum += category.score * CATEGORY_WEIGHTS[category.id];
    weight += CATEGORY_WEIGHTS[category.id];
  }
  return weight ? Math.round(sum / weight) : 0;
}

const AD_WEIGHTS: Partial<Record<CategoryId, number>> = { conversion: 35, analytics: 25, offer: 15, ux: 15, performance: 10 };

/**
 * Рекламная готовность: конверсия и измеримость важнее SEO.
 * Блокеры ограничивают балл сверху — нельзя «добрать» отсутствие связи хорошей скоростью.
 */
export function adReadiness(categories: CategoryResult[], checks: Check[], signals: Signals): { score: number; caps: string[] } {
  let sum = 0;
  let weight = 0;
  for (const category of categories) {
    const w = AD_WEIGHTS[category.id];
    if (!w || category.score === null) continue;
    sum += category.score * w;
    weight += w;
  }
  let score = weight ? Math.round(sum / weight) : 0;
  const caps: string[] = [];
  const failed = (id: string) => checks.find((item) => item.id === id)?.status === "fail";
  const cap = (limit: number, reason: string) => {
    if (score > limit) score = limit;
    caps.push(reason);
  };
  if (signals.home.status >= 400) cap(15, "сайт отвечает ошибкой");
  if (failed("conv.contact_paths")) cap(35, "нет ни формы, ни телефона, ни мессенджера");
  if (failed("seo.https")) cap(50, "нет HTTPS");
  if (failed("an.metrika")) cap(60, "нет Яндекс.Метрики — конверсии не измерить");
  if (failed("ux.viewport")) cap(55, "нет мобильной адаптации");
  if (failed("conv.cta_fold") && failed("conv.cta_mobile")) cap(65, "нет призыва к действию на первом экране");
  return { score, caps };
}

export function verdictOf(adScore: number, criticalCount: number): Verdict {
  if (adScore >= 75 && criticalCount === 0) return "go";
  if (adScore >= 45) return "fix";
  return "stop";
}

export function priorities(checks: Check[], limit = 10): Priority[] {
  return checks
    .filter((item) => item.status === "fail" || item.status === "warn")
    .filter((item) => item.weight > 0)
    .map((item) => {
      const severity = item.status === "warn" && item.severity === "critical" ? "important" : item.severity;
      const statusFactor = item.status === "fail" ? 1 : 0.6;
      const severityFactor = severity === "critical" ? 1.5 : severity === "important" ? 1.15 : 1;
      const ice = (IMPACT[item.impact] * item.confidence * statusFactor * severityFactor) / EFFORT[item.effort];
      return {
        checkId: item.id,
        category: item.category,
        severity,
        title: item.title,
        why: item.why,
        fix: item.fix,
        evidence: item.evidence,
        url: item.url,
        impact: item.impact,
        effort: item.effort,
        confidence: item.confidence,
        ice: Math.round(ice * 100) / 100,
      };
    })
    .sort((a, b) => b.ice - a.ice)
    .slice(0, limit);
}

export function strengths(checks: Check[], limit = 6): Check[] {
  return checks
    .filter((item) => item.status === "pass" && item.weight >= 1)
    .sort((a, b) => b.weight * IMPACT[b.impact] - a.weight * IMPACT[a.impact])
    .slice(0, limit);
}
