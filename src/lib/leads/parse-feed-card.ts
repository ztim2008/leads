/** Разбор карточки ленты Profi без захода на страницу заказа. */

const NBSP = /[\s\u00a0\u202f]+/g;

const CITIES = [
  "Санкт-Петербурге",
  "Петербурге",
  "Москве",
  "Москва",
  "Санкт-Петербург",
  "Петербург",
  "СПб",
  "Казань",
  "Новосибирск",
  "Екатеринбург",
  "Нижний Новгород",
  "Самара",
  "Челябинск",
  "Омск",
  "Ростов-на-Дону",
  "Ростов",
  "Уфа",
  "Красноярск",
  "Воронеж",
  "Пермь",
  "Волгоград",
  "Краснодар",
  "Саратов",
  "Тюмень",
  "Тольятти",
  "Ижевск",
  "Барнаул",
  "Иркутск",
  "Ульяновск",
  "Хабаровск",
  "Ярославль",
  "Владивосток",
  "Махачкала",
  "Томск",
  "Оренбург",
  "Кемерово",
  "Рязань",
  "Набережные Челны",
  "Пенза",
  "Липецк",
  "Киров",
  "Чебоксары",
  "Калининград",
  "Тула",
  "Курск",
  "Сочи",
  "Ставрополь",
  "Тверь",
  "Магнитогорск",
  "Белгород",
  "Химки",
  "Подольск",
  "Мытищи",
  "Балашиха",
  "Люберцы",
  "Красногорск",
  "Одинцово",
  "Домодедово",
  "Королёв",
  "Королев",
  "Щёлково",
  "Раменское",
  "Жуковский",
  "Видное",
  "Реутов",
  "Долгопрудный",
  "Пушкино",
  "Коломна",
  "Серпухов",
  "Электросталь",
  "Ногинск",
  "Московская область",
  "МО",
  "ЛО",
  "Ленинградская область",
];

const CITY_RE = new RegExp(
  `(?:^|[^А-Яа-яЁё])(${CITIES.slice()
    .sort((a, b) => b.length - a.length)
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})(?:[^А-Яа-яЁё]|$)`,
  "i",
);

const MONTH_LINE =
  /^\d{1,2}\s+(янв|фев|мар|апр|мая|июн|июл|авг|сен|окт|ноя|дек)/i;
const WEEKDAY_RANGE = /\((?:Пн|Вт|Ср|Чт|Пт|Сб|Вс)\)/i;
const TZ_JUNK = /^[-−–—]?\s*\d+\s*часа?$/i;

const NOT_AUTHOR =
  /сайт|лендинг|магазин|тильд|wordpress|shopify|контент|платформ|функционал|заказ|нужн|сдела|создан|доработ|объявлен|дизайн|бюджет|отзыв|клиент|специал|мастер|услуг|ремонт|визитк|корпорат|дистанц|москв|петербург|календар|срок|отклик|предложен|интернет|доска|помощ|анкет|сообщени/i;

export type FeedCardParse = {
  budgetMin?: number;
  budgetMax?: number;
  budgetLabel?: string;
  city?: string;
  remote?: boolean;
  responses?: number;
  responsePrice?: number;
  clientHint?: string;
  ageMinutes?: number;
  ageLabel?: string;
  /** Имя заказчика из ленты (если видно). */
  author?: string;
  /** Отзывы заказчика, если строка есть в тексте ленты. */
  reviewCount?: number;
  /** Новичок / 0 отзывов по тексту ленты. */
  newbie?: boolean;
  /** Суть задачи без мета-шума (для TG). */
  taskSnippet?: string;
  /** Мягкий риск без deep scan. */
  riskHint?: string;
};

function parseNum(raw: string): number | undefined {
  const n = parseInt(raw.replace(NBSP, ""), 10);
  return Number.isFinite(n) && n >= 100 ? n : undefined;
}

function fmtNum(n: number): string {
  return n.toLocaleString("ru-RU").replace(/\u00a0/g, " ");
}

export function formatBudgetLabel(min?: number, max?: number, fromDo?: boolean): string | undefined {
  if (max && min && min !== max) return `${fmtNum(min)}–${fmtNum(max)} ₽`;
  if (max && !min) return `до ${fmtNum(max)} ₽`;
  if (min && fromDo) return `до ${fmtNum(min)} ₽`;
  if (min) return `от ${fmtNum(min)} ₽`;
  return undefined;
}

export function parseFeedCard(text: string, title?: string): FeedCardParse {
  const src = `${title || ""}\n${text || ""}`.replace(/\r/g, "");
  const out: FeedCardParse = {};

  const doM = src.match(/до\s*(\d[\d\s\u00a0\u202f]*)\s*(?:₽|руб)/i);
  const otM = src.match(/от\s*(\d[\d\s\u00a0\u202f]*)\s*(?:₽|руб)/i);
  const rangeM = src.match(/(\d[\d\s\u00a0\u202f]*)\s*[–\-—]\s*(\d[\d\s\u00a0\u202f]*)\s*(?:₽|руб)/i);
  let fromDo = false;
  if (rangeM) {
    out.budgetMin = parseNum(rangeM[1]);
    out.budgetMax = parseNum(rangeM[2]);
  } else if (doM) {
    out.budgetMax = parseNum(doM[1]);
    fromDo = true;
  } else if (otM) {
    out.budgetMin = parseNum(otM[1]);
  } else {
    const any = src.match(/(\d[\d\s\u00a0\u202f]+)\s*(?:₽|руб)/i);
    if (any) out.budgetMin = parseNum(any[1]);
  }
  out.budgetLabel = formatBudgetLabel(out.budgetMin, out.budgetMax, fromDo && !out.budgetMax);
  if (fromDo && out.budgetMax && !out.budgetMin) out.budgetMin = out.budgetMax;

  out.remote = /дистанционн/i.test(src);
  const remoteCity = src.match(/дистанционн[^\n·•]*[·•]\s*([^\n]+)/i);
  if (remoteCity) {
    const chunk = remoteCity[1].replace(NBSP, " ").trim().split(/[·•,]/)[0].trim();
    if (chunk.length >= 2 && chunk.length <= 40 && !/час|мин|август|январ/i.test(chunk)) {
      out.city = normalizeCity(chunk);
    }
  }
  if (!out.city) {
    const m = src.match(CITY_RE);
    if (m) out.city = normalizeCity(m[1]);
  }

  const respM =
    src.match(/(\d+)\s*отклик/i) ||
    src.match(/(\d+)\s*предложени/i) ||
    src.match(/уже\s+(\d+)\s*(?:чел|мастер|специал)/i);
  if (respM) out.responses = parseInt(respM[1], 10);

  const priceM =
    src.match(/(?:цена|стоимость)\s+отклик(?:а)?\s*[:\s]*(\d[\d\s\u00a0\u202f]*)\s*(?:₽|руб)/i) ||
    src.match(/отклик(?:а)?\s*(?:за|—|-|:)?\s*(\d[\d\s\u00a0\u202f]*)\s*(?:₽|руб)/i) ||
    src.match(/(\d[\d\s\u00a0\u202f]*)\s*(?:₽|руб)\s*(?:за\s+)?отклик/i);
  if (priceM) out.responsePrice = parseNum(priceM[1]);

  if (/клиент изучает цены/i.test(src)) out.clientHint = "изучает цены";
  else if (/клиент выбирает/i.test(src)) out.clientHint = "выбирает исполнителя";

  if (/только что/i.test(src)) {
    out.ageMinutes = 0;
    out.ageLabel = "только что";
  } else {
    const minM = src.match(/(\d+)\s*минут/i);
    const hourM = src.match(/(\d+)\s*час/i);
    if (minM) {
      out.ageMinutes = parseInt(minM[1], 10);
      out.ageLabel = `${out.ageMinutes} мин`;
    } else if (hourM) {
      out.ageMinutes = parseInt(hourM[1], 10) * 60;
      out.ageLabel = `${hourM[1]} ч`;
    }
  }

  const reviewM =
    src.match(/(?:оставил[аи]?\s*)?(\d+)\s*отзыв/i) ||
    src.match(/отзывов?\s*[:\-]?\s*(\d+)/i);
  if (reviewM) out.reviewCount = parseInt(reviewM[1], 10);

  out.newbie =
    /новый клиент|новичок|ещё не оставлял(?:а)? отзыв|не оставлял(?:а)? отзыв|без отзывов|0\s*отзыв/i.test(
      src,
    ) || out.reviewCount === 0;

  const { author, taskSnippet, riskHint } = extractFeedExtras(text || "", title || "", out);
  if (author) out.author = author;
  if (taskSnippet) out.taskSnippet = taskSnippet;
  if (riskHint) out.riskHint = riskHint;

  return out;
}

function isMetaLine(line: string, title: string): boolean {
  const t = line.replace(NBSP, " ").trim();
  if (!t || /^(true|false)$/i.test(t)) return true;
  if (title && t.toLowerCase() === title.toLowerCase()) return true;
  if (/^(до|от)\s*\d/.test(t) && /₽|руб/i.test(t)) return true;
  if (/^\d[\d\s\u00a0\u202f]*\s*(?:₽|руб)/i.test(t)) return true;
  if (/дистанционн/i.test(t)) return true;
  if (/только что/i.test(t)) return true;
  if (/^\d+\s*минут/i.test(t) || /^\d+\s*час/i.test(t)) return true;
  if (/назад$/i.test(t) && /\d/.test(t)) return true;
  if (/клиент изучает|клиент выбирает/i.test(t)) return true;
  if (/^\d+\s*отклик/i.test(t) || /цена\s+отклик/i.test(t)) return true;
  if (TZ_JUNK.test(t)) return true;
  if (MONTH_LINE.test(t) || WEEKDAY_RANGE.test(t)) return true;
  if (/^\d{1,2}\s+[а-яё]{3,}\.?/i.test(t) && t.length < 40) return true;
  if (CITY_RE.test(` ${t} `) && t.length < 28 && !/[·•]/.test(t) && t.split(/\s+/).length <= 3) {
    return true;
  }
  return false;
}

function isLikelyAuthor(line: string): boolean {
  const t = line.replace(NBSP, " ").trim();
  if (t.length < 2 || t.length > 36) return false;
  if (NOT_AUTHOR.test(t)) return false;
  if (/\d|₽|·|•|\/|https?:/i.test(t)) return false;
  if (CITY_RE.test(` ${t} `)) return false;
  return /^[A-ZА-ЯЁ][A-Za-zА-Яа-яЁё'’-]*(?:\s+[A-ZА-ЯЁа-яё][A-Za-zА-Яа-яЁё'’-]*){0,2}$/.test(t);
}

function extractFeedExtras(
  text: string,
  title: string,
  meta: Pick<FeedCardParse, "budgetLabel" | "newbie" | "reviewCount">,
): { author?: string; taskSnippet?: string; riskHint?: string } {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(NBSP, " ").trim())
    .filter(Boolean);

  let author: string | undefined;
  const content: string[] = [];

  for (const line of lines) {
    if (isMetaLine(line, title)) continue;
    if (isLikelyAuthor(line)) {
      if (!author) author = line;
      continue;
    }
    content.push(line);
  }

  let blob = content.join(" · ").replace(/\s*·\s*·\s*/g, " · ").trim();
  blob = blob.replace(/^(Уже есть|Пожелания и особенности|Необходимо|Важно)\s*[:：]\s*/i, "");

  blob = blob.replace(/\s{2,}/g, " ").trim();
  if (blob.length > 900) blob = blob.slice(0, 897).replace(/\s+\S*$/, "") + "…";

  const thin = !blob || blob.length < 48;
  const genericTitle = /^(создание|разработка|доработка|сделать|нужен)\s+сайт/i.test(title.trim());
  let riskHint: string | undefined;
  if (thin && genericTitle) riskHint = "мало деталей — сверь на Profi";
  else if (thin) riskHint = "краткое ТЗ в ленте";
  else if (!meta.budgetLabel && genericTitle) riskHint = "бюджет не указан";
  else if (meta.newbie && (meta.reviewCount === 0 || meta.reviewCount == null)) {
    riskHint = "возможный новичок — чаще фейки";
  }

  return {
    author,
    taskSnippet: blob || undefined,
    riskHint,
  };
}

function normalizeCity(raw: string): string {
  const t = raw.replace(NBSP, " ").trim();
  if (/^(спб|петербург|петербурге|санкт-петербурге)$/i.test(t)) return "Санкт-Петербург";
  if (/^москве$/i.test(t)) return "Москва";
  if (/^мо$/i.test(t)) return "Московская область";
  if (/^ло$/i.test(t)) return "Ленинградская область";
  return t.replace(/^г\.\s*/i, "");
}

export function matchedKeyword(text: string, keywords?: string | null): string | undefined {
  if (!keywords?.trim()) return undefined;
  const lower = text.toLowerCase();
  return keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .find((k) => lower.includes(k.toLowerCase()));
}
