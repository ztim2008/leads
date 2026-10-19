import type { ScoreLevel, Severity, Verdict } from "@/lib/diagnost/types";

export function levelOf(score: number): ScoreLevel {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "fair";
  if (score >= 40) return "poor";
  return "critical";
}

export const LEVEL_LABELS: Record<ScoreLevel, string> = {
  excellent: "Отлично",
  good: "Хорошо",
  fair: "Приемлемо",
  poor: "Требует доработки",
  critical: "Критично",
};

export const LEVEL_HEADLINES: Record<ScoreLevel, string> = {
  excellent: "Сайт отлично готов к рекламе",
  good: "Сайт готов к запуску рекламы",
  fair: "Сайт можно запускать, но сначала стоит закрыть пробелы",
  poor: "Сайт требует доработки перед рекламой",
  critical: "Сайт пока не готов принимать рекламный трафик",
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  go: "Можно запускать",
  fix: "Запускать после исправлений",
  stop: "Запускать пока не рекомендуется",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Критично",
  important: "Важно",
  minor: "Желательно",
};

export const LEVEL_WORDS = { low: "Низкое", medium: "Среднее", high: "Высокое" } as const;
export const EFFORT_WORDS = { low: "Низкая", medium: "Средняя", high: "Высокая" } as const;
