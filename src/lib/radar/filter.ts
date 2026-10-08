import { norm, termHit } from "./text";
import type { RadarTrack } from "./tracks";

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

const DESIGN_TITLE = /дизайнер|инфографик|графическ|иллюстратор|креатор/i;
const MARKET_TITLE = /маркетплейс|карточк|инфографик|wildberries|вайлдберриз|\bozon\b|\bwb\b|ламода/i;

/** Роль в заголовке: фраза из профиля или дизайнер + маркетплейс/карточки/инфографика. */
export function titleIsDesignRole(title: string, roleTerms: string[]): boolean {
  if (roleTerms.some((term) => termHit(title, term))) return true;
  const text = norm(title);
  return DESIGN_TITLE.test(text) && MARKET_TITLE.test(text);
}

function exclusionOn(exclusions: string[], key: string): boolean {
  return exclusions.some((item) => norm(item).includes(key));
}

export function tildaTitleOk(title: string): boolean {
  const text = norm(title);
  if (!/тильд|tilda/.test(text)) return false;
  if (/контент-менеджер|администратор|smm|маркетолог|копирайтер/.test(text)) return false;
  return /разработчик|дизайнер|верстальщик|верстк/.test(text);
}

export function isVideoVacancy(title: string): boolean {
  return /видео|video|монтаж|рилс|reels|shorts|тикток|tiktok/.test(norm(title));
}

/** Сайты, поддержка, сисадмин и ИИ-технологии. Не 1С, Java, видео и продажи. */
export function webTitleOk(title: string): boolean {
  const text = norm(title);
  if (isVideoVacancy(title)) return false;
  if (/1[сc]\b|java(?!script)|android|ios\b|data scientist|тестировщик|аналитик данных|гейм-дизайнер|game designer/.test(text)) return false;
  if (/менеджер по продаж|контент-менеджер|\bsmm\b|по продаж/.test(text)) return false;
  if (/офис-менеджер|администратор магазин|администратор салон|секретарь/.test(text)) return false;
  if (/менеджер/.test(text) && !/сайт|веб|web|проект/.test(text)) return false;
  if (/сисадмин|системн[а-я]* администратор|system administrator/.test(text)) return true;
  if (/\bdevops\b|dev-ops|\bsre\b/.test(text)) return true;
  if (/веб-?мастер|webmaster/.test(text)) return true;
  if (/создание сайтов|разработка сайтов|поддержка сайтов|ведение сайтов|продвижение сайтов|поддержка сайта|администратор сайта|администратор сайтов/.test(text)) {
    return true;
  }
  if (/техническ[а-я]* поддержк/.test(text) && /сайт|сервер|веб|хостинг|инфраструктур/.test(text)) return true;
  const role = /разработчик|developer|дизайнер|программист|инженер|engineer|верстальщик|специалист|архитектор|технолог/.test(text);
  const web = /веб|web|сайт|лендинг|frontend|front-end|фронтенд|fullstack|full-stack|react\b|next\.?js|хостинг/.test(text);
  const aiTech = /искусственн[а-я]*\s+интеллект|\bllm\b|machine learning|(^|[^a-zа-я])(ai|ии)([^a-zа-я]|$)|нейросет/.test(text);
  if (aiTech && /продаж|обучен|курс|школ|adult|порн|гейм/.test(text)) return false;
  if (aiTech && (role || /технолог|автоматизац|агент|внедрен/.test(text))) return true;
  return web && role;
}

export function aiTitleOk(title: string): boolean {
  const text = norm(title);
  if (isVideoVacancy(title)) return false;
  if (/machine learning|data scientist|python|обучени|по продаж|software|fullstack|разработчик|adult|порн|эротич/.test(text)) {
    return false;
  }
  if (/менеджер/.test(text) && !/дизайнер|креатор/.test(text)) return false;
  return /(ai|ии)[-\s/]?(дизайнер|креатор)|(дизайнер|креатор)[-\s/]?(ai|ии)/.test(text);
}

export function passesHardFilter(
  vacancy: RadarVacancyText,
  profile: RadarFilterProfile,
  track: RadarTrack = "cards",
): FilterDecision {
  const title = norm(vacancy.title);
  const body = norm(`${vacancy.title}\n${vacancy.description}`);

  if (profile.remoteOnly && !vacancy.remote) {
    return { ok: false, reason: "не удалёнка" };
  }
  if (exclusionOn(profile.exclusions, "офис") && !vacancy.remote) {
    return { ok: false, reason: "офис" };
  }

  for (const rule of TITLE_EXCLUSIONS) {
    if (track !== "cards" && (rule.key === "программирование" || rule.key === "frontend")) continue;
    if (!exclusionOn(profile.exclusions, rule.key)) continue;
    if (rule.re.test(title)) return { ok: false, reason: rule.key };
  }
  for (const rule of BODY_EXCLUSIONS) {
    if (track !== "cards" && (rule.key === "программирование" || rule.key === "frontend")) continue;
    if (!exclusionOn(profile.exclusions, rule.key)) continue;
    if (rule.re.test(body)) return { ok: false, reason: rule.key };
  }
  for (const raw of profile.exclusions) {
    const item = norm(raw);
    if (["программирование", "frontend", "офис", "продажи"].some((key) => item.includes(key))) continue;
    if (item.length >= 4 && title.includes(item)) return { ok: false, reason: raw };
  }

  if (track === "tilda") {
    if (!tildaTitleOk(vacancy.title)) return { ok: false, reason: "в заголовке другая роль" };
    return { ok: true, hits: ["Tilda"] };
  }
  if (track === "ai") {
    if (!aiTitleOk(vacancy.title)) return { ok: false, reason: "в заголовке другая роль" };
    return { ok: true, hits: ["AI"] };
  }
  if (track === "web") {
    if (!webTitleOk(vacancy.title)) return { ok: false, reason: "в заголовке другая роль" };
    return { ok: true, hits: ["Веб"] };
  }

  const roleTerms = [
    ...profile.specialization.split(/[/|,]+/),
    ...profile.skills,
    ...profile.directions.filter((term) => !brandOnly(term)),
  ];
  if (!titleIsDesignRole(vacancy.title, roleTerms)) {
    return { ok: false, reason: "в заголовке другая роль" };
  }

  const hits: string[] = [];
  for (const term of [...profile.directions, ...profile.skills]) {
    if (termHit(body, term)) hits.push(term);
  }
  if (!hits.length) return { ok: false, reason: "нет совпадения с профилем" };
  return { ok: true, hits };
}
