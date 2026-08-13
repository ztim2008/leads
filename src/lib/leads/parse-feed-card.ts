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
    src.match(/(?:цена\s+)?отклик(?:а)?\s*[:\s]*(\d[\d\s\u00a0\u202f]*)\s*(?:₽|руб)/i) ||
    src.match(/отклик\s+(\d[\d\s\u00a0\u202f]*)\s*(?:₽|руб)/i);
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

  return out;
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
