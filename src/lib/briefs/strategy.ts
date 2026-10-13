import type { PresentFinding } from "@/lib/briefs/present";

export type StrategyOutline = {
  gaps: string[];
  actions: { title: string; body: string }[];
  proposal: { label: string; value: string }[];
};

export function strategyOutline(input: {
  company: string;
  niche: string;
  regionName: string;
  goal: string;
  findings: PresentFinding[];
  hasSemantics: boolean;
}): StrategyOutline {
  const gaps = [
    input.hasSemantics
      ? "Показы Wordstat есть в блоке семантики."
      : "Показы Wordstat: нет данных. Этап отложен до оплаты счёта Yandex Cloud.",
    "Конкуренты в выдаче: нет данных.",
    "Цену, срок и прогноз заявок ставит человек. Из сайта они не выводятся.",
  ];
  return {
    gaps,
    actions: input.findings
      .filter((finding) => finding.kind === "recommendation")
      .map((finding) => ({ title: finding.title, body: finding.body })),
    proposal: [
      { label: "Кому", value: `${input.company}. ${input.niche}.` },
      { label: "Регион", value: input.regionName },
      { label: "Задача", value: input.goal },
      {
        label: "Что делаем",
        value: "Кампания в Яндекс.Директе по фактам сайта. Объявления в кабинет не отправляются.",
      },
      { label: "Цена", value: "Заполняет человек." },
      { label: "Срок", value: "Заполняет человек." },
    ],
  };
}
