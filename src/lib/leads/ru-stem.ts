/** Лёгкий стеммер русских слов для фильтров. Без внешних словарей. */

export function normalizeRu(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е");
}

const ENDINGS = [
  "иями",
  "ями",
  "ами",
  "иях",
  "ого",
  "его",
  "ому",
  "ему",
  "ыми",
  "ими",
  "ые",
  "ие",
  "ое",
  "ее",
  "ая",
  "яя",
  "ую",
  "юю",
  "ою",
  "ею",
  "ий",
  "ый",
  "ой",
  "ей",
  "ов",
  "ев",
  "ом",
  "ем",
  "ам",
  "ям",
  "ах",
  "ях",
  "ия",
  "ии",
  "ию",
  "ья",
  "ье",
  "ью",
  "а",
  "я",
  "ы",
  "и",
  "о",
  "е",
  "у",
  "ю",
  "ь",
];

export function stemRu(word: string): string {
  const w = normalizeRu(word);
  if (w.length < 4 || !/[а-я]/.test(w)) return w;
  let cur = w;
  for (let pass = 0; pass < 2; pass++) {
    let hit = false;
    for (const end of ENDINGS) {
      if (cur.endsWith(end) && cur.length - end.length >= 3) {
        cur = cur.slice(0, -end.length);
        hit = true;
        break;
      }
    }
    if (!hit) break;
  }
  return cur;
}

export function tokenizeRu(text: string): string[] {
  return normalizeRu(text)
    .split(/[^a-zа-я0-9]+/)
    .filter((t) => t.length >= 2);
}

/** Одно слово или фраза («создание сайта») есть в тексте с учётом склонений. */
export function textHasTerm(text: string, term: string): boolean {
  const n = normalizeRu(term);
  if (n.length < 2) return false;
  const hay = normalizeRu(text);
  if (n.length >= 4 && hay.includes(n)) return true;

  const parts = n.split(/[^a-zа-я0-9]+/).filter((p) => p.length >= 2);
  if (parts.length > 1) return parts.every((p) => textHasTerm(text, p));

  const needleStem = stemRu(n);
  return tokenizeRu(hay).some((tok) => {
    if (tok === n) return true;
    const ts = stemRu(tok);
    if (ts.length >= 3 && needleStem.length >= 3 && ts === needleStem) return true;
    if (needleStem.length >= 4 && (tok.startsWith(needleStem) || ts.startsWith(needleStem))) return true;
    return false;
  });
}

export function listHasMatch(text: string, list: string | undefined | null): boolean {
  const terms = String(list || "")
    .split(",")
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
  if (terms.length === 0) return true;
  return terms.some((t) => textHasTerm(text, t));
}

export function listHitsMinus(text: string, list: string | undefined | null): boolean {
  const terms = String(list || "")
    .split(",")
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
  if (terms.length === 0) return false;
  return terms.some((t) => textHasTerm(text, t));
}
