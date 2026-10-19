export type StageId =
  | "connect"
  | "business"
  | "structure"
  | "first_screen"
  | "seo"
  | "speed"
  | "mobile"
  | "conversion"
  | "trust"
  | "recommendations"
  | "report";

export type StageState = "waiting" | "processing" | "completed" | "warning" | "error";

export type StageRow = { id: StageId; state: StageState; note: string | null };

export const STAGES: { id: StageId; label: string; hint: string }[] = [
  { id: "connect", label: "Подключение к сайту", hint: "Открываем адрес, смотрим ответ сервера и перенаправления" },
  { id: "business", label: "Определение типа бизнеса", hint: "Понимаем, что за сайт: магазин, услуги, B2B" },
  { id: "structure", label: "Анализ структуры страниц", hint: "Проходим по ключевым разделам: услуги, цены, контакты" },
  { id: "first_screen", label: "Анализ первого экрана", hint: "Проверяем, насколько быстро посетитель понимает, что ему предлагают" },
  { id: "seo", label: "Проверка SEO", hint: "Заголовки, индексация, robots.txt и карта сайта" },
  { id: "speed", label: "Проверка скорости", hint: "Замеряем загрузку и вес страницы в браузере" },
  { id: "mobile", label: "Анализ мобильной версии", hint: "Большая часть рекламного трафика приходит с телефона" },
  { id: "conversion", label: "Анализ конверсионных элементов", hint: "Ищем CTA и точки конверсии" },
  { id: "trust", label: "Анализ доверия", hint: "Проверяем наличие доверительных факторов" },
  { id: "recommendations", label: "Формирование рекомендаций", hint: "AI читает собранные факты и скриншоты" },
  { id: "report", label: "Подготовка отчёта", hint: "Считаем баллы и собираем план исправлений" },
];

export function initialStages(): StageRow[] {
  return STAGES.map((stage) => ({ id: stage.id, state: "waiting", note: null }));
}

export function progressOf(rows: StageRow[]): number {
  const done = rows.filter((row) => row.state === "completed" || row.state === "warning" || row.state === "error").length;
  const active = rows.some((row) => row.state === "processing") ? 0.5 : 0;
  return Math.min(99, Math.round(((done + active) / rows.length) * 100));
}
