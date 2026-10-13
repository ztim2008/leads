import type { PresentFinding } from "@/lib/briefs/present";
import { seoOutline, type SeoRow } from "@/lib/briefs/seo";

export type CompareSide = {
  good: string[];
  bad: string[];
};

export function directologistCompare(input: {
  niche: string;
  regionName: string;
  findings: PresentFinding[];
}): CompareSide {
  const good: string[] = [];
  const bad: string[] = [];
  const opened = input.findings.find((finding) => finding.title.includes("Главная страница"));
  if (opened?.title.includes("не открылась")) bad.push("Главная не открылась. Вести объявление на неё нельзя, пока она не отвечает.");
  else if (opened) good.push("Главная открывается. На неё можно вести объявление.");

  const contact = input.findings.find((finding) => finding.title.startsWith("Способы связи") || finding.title.startsWith("Форма и телефон"));
  if (contact?.title.startsWith("Способы связи")) {
    const line = contact.body.split("\n")[0]?.replace(/^https?:\/\/\S+:\s*/, "") || contact.title;
    good.push(`Связь на сайте есть: ${clip(line, 140)}`);
  } else if (contact) {
    bad.push("Телефон, почта и форма не найдены. В объявлении не обещать, что заявка уйдёт с сайта.");
  }

  const prices = input.findings.find((finding) => /цен/i.test(finding.title));
  if (prices && /не найден/i.test(prices.title)) bad.push("Цены на изученных страницах нет. В текст объявления сумму не ставить.");
  else if (prices) good.push("Цена на сайте написана. В объявление можно взять её дословно.");

  const seo = seoOutline(input);
  const city = seo.find((row) => row.observation.startsWith("Город"));
  if (city?.tone === "good") good.push(city.observation);
  if (city?.tone === "bad") bad.push(`${city.observation} В заголовок объявления город лучше не ставить, пока его нет на странице.`);
  const title = seo.find((row) => row.observation.startsWith("Title"));
  if (title?.tone === "good") good.push(clip(title.observation, 180));
  if (title?.tone === "bad") bad.push(`${title.observation} ${title.action}`);

  if (!good.length) good.push("По изученным страницам нет явного плюса для объявления.");
  if (!bad.length) bad.push("Явной дыры для текста объявления не видно. Цену и обещания всё равно сверять со страницей.");
  return { good, bad };
}

export function developerCompare(rows: SeoRow[]): CompareSide {
  const good = rows.filter((row) => row.tone === "good").map((row) => row.observation);
  const bad = rows.filter((row) => row.tone === "bad").map((row) => `${row.observation} ${row.action}`);
  return {
    good: good.length ? good : ["По изученным страницам явного плюса для HTML не видно."],
    bad: bad.length ? bad : ["По изученным страницам явной ошибки HTML не видно."],
  };
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}
