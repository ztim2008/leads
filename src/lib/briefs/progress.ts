export const BRIEF_STAGES = [
  { id: "home", label: "Открываю главную" },
  { id: "pages", label: "Читаю страницы сайта" },
  { id: "files", label: "Проверяю robots.txt и sitemap.xml" },
  { id: "model", label: "Разбираю тексты моделью" },
  { id: "save", label: "Собираю отчёт" },
] as const;

export type BriefStage = (typeof BRIEF_STAGES)[number]["id"];

const WEIGHT: Record<BriefStage, [number, number]> = {
  home: [5, 15],
  pages: [15, 55],
  files: [55, 62],
  model: [62, 92],
  save: [92, 98],
};

/** pagesDone/pagesTotal двигают полосу только внутри шага «страницы». */
export function briefPercent(input: {
  status: string;
  stage: string | null;
  pagesDone?: number;
  pagesTotal?: number;
}): number {
  if (input.status === "ready" || input.status === "done") return 100;
  if (input.status === "queued" || !input.stage) return 3;
  const range = WEIGHT[input.stage as BriefStage];
  if (!range) return 3;
  if (input.stage === "pages" && input.pagesTotal) {
    const share = Math.min(1, (input.pagesDone || 0) / input.pagesTotal);
    return Math.round(range[0] + (range[1] - range[0]) * share);
  }
  return range[0];
}

export function stageIndex(stage: string | null): number {
  return BRIEF_STAGES.findIndex((item) => item.id === stage);
}
