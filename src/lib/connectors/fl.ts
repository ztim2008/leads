/**
 * FL.ru — разбор публичной ленты проектов (без входа в аккаунт).
 * Чистые функции: HTML → поля. Сеть — в src/collectors/fl-poller.ts.
 */

export const FL_ORIGIN = "https://www.fl.ru";

export interface FlCard {
  id: string;
  title: string;
  url: string;
  kind: string;
  budgetLabel: string;
  budgetMin?: number;
  budgetMax?: number;
  snippet: string;
  ageLabel: string | null;
  responses: number | null;
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&#160;": " ", "&amp;": "&", "&quot;": '"', "&#039;": "'", "&#39;": "'",
  "&lt;": "<", "&gt;": ">", "&laquo;": "«", "&raquo;": "»", "&mdash;": "—", "&ndash;": "–",
  "&#8381;": "₽", "&hellip;": "…",
};

export function flText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[#a-z0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? " ")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function num(s: string): number | undefined {
  const v = parseInt(s.replace(/\s/g, ""), 10);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

export function parseFlBudget(label: string): { min?: number; max?: number } {
  const nums = [...label.replace(/\u00a0/g, " ").matchAll(/(\d[\d ]*\d|\d)\s*₽/g)].map((m) => num(m[1]));
  const vals = nums.filter((n): n is number => n != null);
  if (!vals.length) return {};
  return { min: vals[0], max: vals.length > 1 ? vals[vals.length - 1] : vals[0] };
}

export function parseFlResponses(label: string | undefined): number | null {
  if (!label) return null;
  if (/нет ответов/i.test(label)) return 0;
  const m = label.match(/(\d+)\s*ответ/);
  return m ? Number(m[1]) : null;
}

export function parseFlList(html: string): FlCard[] {
  const parts = html.split(/id="project-item(\d+)"/);
  const out: FlCard[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i];
    const c = parts[i + 1].slice(0, 12000);
    const t = c.match(new RegExp(`id="prj_name_${id}"[^>]*href="([^"]+)"[^>]*>([\\s\\S]*?)</a>`));
    if (!t) continue;
    const price = c.match(/b-post__price[^"]*">([\s\S]*?)<\/div>/);
    const kind = c.match(/b-post__bold[^"]*">\s*([^<]+?)\s*<\/span>/);
    const snippet = c.match(/b-post__txt text-5[^"]*">([\s\S]*?)<\/div>/);
    const age = c.match(/text-gray-opacity-4[^"]*">\s*([^<]+?)\s*</);
    const ans = c.match(/#message-empty"><\/use>\s*<\/svg>\s*([^<]+?)\s*</);
    const budgetLabel = price ? flText(price[1]) : "";
    const b = parseFlBudget(budgetLabel);
    out.push({
      id,
      title: flText(t[2]),
      url: FL_ORIGIN + t[1],
      kind: kind ? flText(kind[1]) : "",
      budgetLabel,
      budgetMin: b.min,
      budgetMax: b.max,
      snippet: snippet ? flText(snippet[1]) : "",
      ageLabel: age ? flText(age[1]) : null,
      responses: parseFlResponses(ans?.[1]),
    });
  }
  return out;
}

/** Полный текст задания со страницы проекта. null — блок не найден (вёрстка поменялась или нас не пустили). */
export function parseFlDescription(html: string, id: string): string | null {
  const m = html.match(new RegExp(`id="projectp${id}"[^>]*>([\\s\\S]*?)</div>`));
  if (!m) return null;
  const text = flText(m[1]);
  return text || null;
}

/**
 * Раздел проекта (выбирает заказчик): saity / landing и т.п.
 * Берём только ссылки с меткой click_path_in_projects — в шапке страницы есть меню со всеми разделами.
 */
export function parseFlCategory(html: string): { category: string; subcategory: string | null } | null {
  const re = /click_path_in_projects[^>]*?href="(?:https:\/\/www\.fl\.ru)?\/projects\/category\/([a-z0-9-]+)\/(?:([a-z0-9-]+)\/)?"/g;
  const hits = [...html.matchAll(re)];
  if (!hits.length) return null;
  const category = hits[0][1];
  const sub = hits.find((h) => h[1] === category && h[2]);
  return { category, subcategory: sub?.[2] || null };
}

/** Фильтр источника по разделу FL. Раздел не распознан — пропускаем дальше к фильтру по словам. */
export function flCategoryPasses(
  cat: { category: string; subcategory: string | null } | null,
  cfg: Record<string, unknown>,
): boolean {
  const allow = Array.isArray(cfg.flCategories) ? (cfg.flCategories as string[]) : [];
  const deny = Array.isArray(cfg.flExcludeSubcategories) ? (cfg.flExcludeSubcategories as string[]) : [];
  if (!cat) return true;
  if (allow.length && !allow.includes(cat.category)) return false;
  if (cat.subcategory && deny.includes(cat.subcategory)) return false;
  return true;
}

export function isFlOrder(card: FlCard): boolean {
  return /^заказ/i.test(card.kind);
}
