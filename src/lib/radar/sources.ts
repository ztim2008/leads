export function sourceLabel(source: string | null | undefined): string {
  if (source === "trudvsem") return "Работа России";
  if (source === "rabota") return "Работа.ру";
  if (source === "hh") return "HH";
  return "Вакансия";
}
