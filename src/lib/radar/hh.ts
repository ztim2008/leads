import { stripHtml } from "./text";

/**
 * api.hh.ru с хаба отвечает 403 (ddos-guard).
 * Публичная выдача hh.ru отдаёт то же в блоке HH-Lux-InitialState.
 * Берём дату создания вакансии, а не время поднятия в поиске.
 */

const PAGE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export type HhSearchHit = {
  id: string;
  title: string;
  url: string;
  company: string | null;
  companyUrl: string | null;
  employerId: string | null;
  salaryFrom: number | null;
  salaryTo: number | null;
  salaryCurrency: string | null;
  salaryGross: boolean | null;
  area: string | null;
  remote: boolean;
  employment: string | null;
  /** Дата создания вакансии, не автоподнятия. */
  publishedAt: string | null;
  snippet: string;
  trusted: boolean | null;
  responsesCount: number | null;
};

const EMPLOYMENT: Record<string, string> = {
  FULL: "Полная занятость",
  PART: "Частичная занятость",
  PROJECT: "Проект",
  FLY_IN_FLY_OUT: "Вахта",
};

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

export function parseLuxState(html: string): Record<string, unknown> | null {
  const marker = 'id="HH-Lux-InitialState">';
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const from = start + marker.length;
  const end = html.indexOf("</template>", from);
  if (end < 0) return null;
  try {
    const parsed = JSON.parse(decodeEntities(html.slice(from, end)));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function employmentLabel(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  return EMPLOYMENT[raw] || raw;
}

export function parseSearchHits(html: string): HhSearchHit[] {
  const state = parseLuxState(html);
  const result = asRecord(state?.vacancySearchResult);
  const list = result?.vacancies;
  if (!Array.isArray(list)) return [];
  return list.map(parseSearchVacancy).filter((item): item is HhSearchHit => item != null);
}

function parseSearchVacancy(raw: unknown): HhSearchHit | null {
  const item = asRecord(raw);
  if (!item) return null;
  const id = String(item.vacancyId || "");
  if (!id) return null;
  const company = asRecord(item.company);
  const compensation = asRecord(item.compensation);
  const area = asRecord(item.area);
  const links = asRecord(item.links);
  const formats = Array.isArray(item.workFormats) ? item.workFormats.map(String) : [];
  const schedule = String(item["@workSchedule"] || "");
  const remote = formats.includes("REMOTE") || schedule === "remote" || /удал/i.test(schedule);
  const trusted =
    company?.["@trusted"] === true || company?.trusted === true || company?.accreditedITEmployer === true
      ? true
      : company?.["@trusted"] === false
        ? false
        : null;
  return {
    id,
    title: String(item.name || "Вакансия"),
    url: String(links?.desktop || `https://hh.ru/vacancy/${id}`),
    company: (company?.visibleName as string) || (company?.name as string) || null,
    companyUrl: company?.id ? `https://hh.ru/employer/${company.id}` : null,
    employerId: company?.id ? String(company.id) : null,
    salaryFrom: num(compensation?.from),
    salaryTo: num(compensation?.to),
    salaryCurrency: typeof compensation?.currencyCode === "string" ? compensation.currencyCode : null,
    salaryGross: typeof compensation?.gross === "boolean" ? compensation.gross : null,
    area: typeof area?.name === "string" ? area.name : null,
    remote,
    employment: employmentLabel(item.employmentForm),
    publishedAt: typeof item.creationTime === "string" ? item.creationTime : null,
    snippet: "",
    trusted,
    responsesCount: num(item.responsesCount) ?? num(item.totalResponsesCount),
  };
}

async function hhPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": PAGE_UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ru-RU,ru;q=0.9",
    },
    signal: AbortSignal.timeout(20000),
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`HH ${response.status}`);
  }
  const html = await response.text();
  if (!html.includes("HH-Lux-InitialState")) {
    throw new Error("HH отдал страницу без данных вакансий");
  }
  return html;
}

export async function searchHh(params: URLSearchParams): Promise<HhSearchHit[]> {
  const query = new URLSearchParams({
    text: params.get("text") || "",
    area: params.get("area") || "113",
    order_by: "publication_time",
    items_on_page: "20",
    search_period: "30",
    currency_code: "RUR",
  });
  if (params.get("schedule") === "remote") query.set("work_format", "REMOTE");
  const field = params.get("search_field");
  if (field) query.set("search_field", field);
  const salary = params.get("salary");
  if (salary && params.get("only_with_salary") === "true") {
    query.set("salary", salary);
    query.set("only_with_salary", "true");
  }
  const html = await hhPage(`https://hh.ru/search/vacancy?${query.toString()}`);
  return parseSearchHits(html);
}

export type HhVacancyDetail = {
  description: string;
  trusted: boolean | null;
  employment: string | null;
  remote: boolean;
  keySkills: string[];
};

export async function fetchHhVacancy(id: string): Promise<HhVacancyDetail | null> {
  const html = await hhPage(`https://hh.ru/vacancy/${encodeURIComponent(id)}`);
  const state = parseLuxState(html);
  const full = asRecord(asRecord(state?.vacancyView)?.vacancyFull);
  const vacancy = asRecord(full?.vacancy);
  if (!vacancy) return null;
  const company = asRecord(vacancy.company);
  const formats = Array.isArray(vacancy.workFormats) ? vacancy.workFormats.map(String) : [];
  const skills = Array.isArray(vacancy.keySkills)
    ? vacancy.keySkills
        .map((skill) => {
          if (typeof skill === "string") return skill;
          const row = asRecord(skill);
          return typeof row?.name === "string" ? row.name : "";
        })
        .filter(Boolean)
    : [];
  const trusted =
    company?.trusted === true || company?.accreditedITEmployer === true
      ? true
      : company?.trusted === false
        ? false
        : null;
  return {
    description: stripHtml(String(vacancy.description || "")),
    trusted,
    employment: employmentLabel(vacancy.employmentForm),
    remote: formats.includes("REMOTE"),
    keySkills: skills,
  };
}

/** Счётчик вакансий работодателя живёт в API, который с хаба закрыт. */
export async function fetchEmployerVacancyCount(_employerId: string): Promise<number | null> {
  return null;
}
