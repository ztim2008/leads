import { salaryBelowFloor } from "./money";
import { norm, termHit } from "./text";

export type RadarFilterProfile = {
  salaryMin: number;
  requireSalary: boolean;
  remoteOnly: boolean;
  specialization: string;
  directions: string[];
  skills: string[];
  exclusions: string[];
};

export type RadarVacancyText = {
  title: string;
  description: string;
  salaryFrom: number | null;
  salaryTo: number | null;
  salaryCurrency: string | null;
  remote: boolean;
};

export type FilterDecision = { ok: true; hits: string[] } | { ok: false; reason: string };

const TITLE_EXCLUSIONS: { key: string; re: RegExp }[] = [
  { key: "программирование", re: /программист|разработчик|developer|backend|python|java(?!script)|php|1[сc]\b/i },
  { key: "frontend", re: /frontend|front-end|фронтенд|react\b|vue\b|angular/i },
  { key: "продажи", re: /менеджер по продаж|отдел продаж|sales manager|специалист по продаж|\bпродажи\b/i },
];

const BRANDS = new Set([
  "ozon",
  "wildberries",
  "wb",
  "вб",
  "avito",
  "авито",
  "вайлдберриз",
  "lamoda",
  "ламода",
  "яндексмаркет",
  "яндекскит",
  "якит",
]);

function brandOnly(term: string): boolean {
  const key = norm(term).replace(/[^a-zа-я0-9]+/gi, "");
  return BRANDS.has(key);
}

const BODY_EXCLUSIONS: { key: string; re: RegExp }[] = [
  { key: "программирование", re: /ищем программист|вакансия программист|frontend-разработ|фронтенд-разработ/i },
  { key: "frontend", re: /frontend-разработ|фронтенд-разработ|front-end developer/i },
  { key: "продажи", re: /менеджер по продаж|отдел продаж|sales manager/i },
];

function exclusionOn(exclusions: string[], key: string): boolean {
  return exclusions.some((item) => norm(item).includes(key));
}

export function passesHardFilter(vacancy: RadarVacancyText, profile: RadarFilterProfile): FilterDecision {
  const title = norm(vacancy.title);
  const body = norm(`${vacancy.title}\n${vacancy.description}`);

  if (profile.remoteOnly && !vacancy.remote) {
    return { ok: false, reason: "не удалёнка" };
  }
  if (exclusionOn(profile.exclusions, "офис") && !vacancy.remote) {
    return { ok: false, reason: "офис" };
  }

  for (const rule of TITLE_EXCLUSIONS) {
    if (!exclusionOn(profile.exclusions, rule.key)) continue;
    if (rule.re.test(title)) return { ok: false, reason: rule.key };
  }
  for (const rule of BODY_EXCLUSIONS) {
    if (!exclusionOn(profile.exclusions, rule.key)) continue;
    if (rule.re.test(body)) return { ok: false, reason: rule.key };
  }
  for (const raw of profile.exclusions) {
    const item = norm(raw);
    if (["программирование", "frontend", "офис", "продажи"].some((key) => item.includes(key))) continue;
    if (item.length >= 4 && title.includes(item)) return { ok: false, reason: raw };
  }

  const below = salaryBelowFloor(vacancy.salaryFrom, vacancy.salaryTo, vacancy.salaryCurrency, profile.salaryMin);
  if (below === true) return { ok: false, reason: "зарплата ниже минимума" };
  if (below == null && profile.requireSalary) return { ok: false, reason: "зарплата не указана" };

  const roleTerms = [
    ...profile.specialization.split(/[/|,]+/),
    ...profile.skills,
    ...profile.directions.filter((term) => !brandOnly(term)),
  ];
  if (!roleTerms.some((term) => termHit(vacancy.title, term))) {
    return { ok: false, reason: "в заголовке другая роль" };
  }

  const hits: string[] = [];
  for (const term of [...profile.directions, ...profile.skills]) {
    if (termHit(body, term)) hits.push(term);
  }
  if (!hits.length) return { ok: false, reason: "нет совпадения с профилем" };
  return { ok: true, hits };
}
