export const BRIEF_SECTIONS = [
  { id: "site", title: "Аудит сайта", ready: true },
  { id: "competitors", title: "Конкуренты", ready: false },
  { id: "semantics", title: "Семантика", ready: false },
  { id: "strategy", title: "Рекламная стратегия", ready: false },
  { id: "proposal", title: "Коммерческое предложение", ready: false },
] as const;

export type BriefSectionId = (typeof BRIEF_SECTIONS)[number]["id"];

export const FINDING_KINDS = ["fact", "hypothesis", "recommendation"] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

export const KIND_LABELS: Record<FindingKind, string> = {
  fact: "Факт",
  hypothesis: "Гипотеза",
  recommendation: "Рекомендация",
};

export const GROUP_LABELS: Record<FindingKind, string> = {
  fact: "Факты",
  hypothesis: "Гипотезы",
  recommendation: "Рекомендации",
};

export const SECTION_EMPTY =
  "Нет данных. Этот блок появится на следующем этапе, когда будет подключён источник.";
