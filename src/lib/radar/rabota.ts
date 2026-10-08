import { publishedToday } from "./responses";
import { ensureRabotaAccess } from "./rabota-oauth";
import { stripHtml } from "./text";

/**
 * Официальный API Rabota.ru. Сайт не скрейпим.
 * Удалёнка — график schedule_ids: 6 («удаленная работа»).
 * Страны в справочнике регионов нет: выдача зависит от города.
 * Москва, Петербург и Краснодарский край вместе дают городские ленты
 * и общий набор удалённых вакансий, который API подмешивает в небольшие регионы.
 */

const API = "https://api.rabota.ru/v5/vacancies/search.json";
const REMOTE_SCHEDULE_ID = 6;
const SEARCH_REGIONS = [3, 4, 17];

export type RabotaHit = {
  id: string;
  title: string;
  url: string;
  company: string | null;
  companyUrl: string | null;
  salaryFrom: number | null;
  salaryTo: number | null;
  salaryCurrency: string | null;
  area: string | null;
  remote: boolean;
  employment: string | null;
  publishedAt: Date | null;
  description: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function money(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export function rabotaPublishedAt(value: string, now = new Date()): Date | null {
  const published = new Date(value);
  if (Number.isNaN(published.getTime())) return null;
  if (!publishedToday(published, now)) return null;
  return published;
}

export function parseRabotaVacancies(payload: unknown, now = new Date()): RabotaHit[] {
  const root = asRecord(payload);
  const response = asRecord(root?.response) || root;
  const rows = Array.isArray(response?.vacancies) ? response.vacancies : [];
  const hits: RabotaHit[] = [];
  for (const row of rows) {
    const vacancy = asRecord(row);
    if (!vacancy) continue;
    const id = String(vacancy.id || "").trim();
    const title = textOf(vacancy.title);
    if (!id || !title) continue;
    const publishedAt = rabotaPublishedAt(textOf(vacancy.publish_start_at), now);
    if (!publishedAt) continue;
    const schedule = asRecord(vacancy.operating_schedule);
    const scheduleId = Number(schedule?.id);
    const remote = scheduleId === REMOTE_SCHEDULE_ID;
    const salary = asRecord(vacancy.salary);
    const salaryFrom = money(salary?.from);
    const salaryToRaw = money(salary?.to);
    const currency = textOf(salary?.currency);
    const company = asRecord(vacancy.company);
    const slug = textOf(company?.slug);
    const places = Array.isArray(vacancy.places) ? vacancy.places : [];
    const place = asRecord(places[0]);
    const region = asRecord(place?.region);
    const description = stripHtml(textOf(vacancy.description) || textOf(vacancy.short_description));
    hits.push({
      id: id.slice(0, 180),
      title,
      url: `https://www.rabota.ru/vacancy/${encodeURIComponent(id)}/`,
      company: textOf(company?.name) || null,
      companyUrl: slug ? `https://www.rabota.ru/company/${encodeURIComponent(slug)}/` : null,
      salaryFrom,
      salaryTo: salaryToRaw != null && salaryFrom != null && salaryToRaw < salaryFrom ? null : salaryToRaw,
      salaryCurrency: salaryFrom != null || salaryToRaw != null ? (currency.toLowerCase().includes("руб") ? "RUR" : currency || "RUR") : null,
      area: textOf(region?.name) || textOf(place?.name) || null,
      remote,
      employment: textOf(schedule?.name) || null,
      publishedAt,
      description,
    });
  }
  return hits;
}

async function searchRegion(
  query: string,
  regionId: number,
  auth: { appId: string; accessToken: string },
  now: Date,
): Promise<RabotaHit[]> {
  const response = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Token": auth.accessToken,
      "Application-Id": auth.appId,
    },
    body: JSON.stringify({
      request: {
        query,
        limit: 20,
        offset: 0,
        location: { type: "region", region_id: regionId },
        sort: { field: "date", direction: "desc" },
        filters: { schedule_ids: [REMOTE_SCHEDULE_ID] },
        fields: ["salary"],
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Rabota.ru поиск ${response.status}`);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Rabota.ru ответила не JSON");
  }
  return parseRabotaVacancies(payload, now);
}

/** Один регион и одна карточка: утром проверяем токен и поиск. */
export async function pingRabota(): Promise<void> {
  const auth = await ensureRabotaAccess();
  if (!auth) throw new Error("Работа.ру: нет токена");
  const response = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Token": auth.accessToken,
      "Application-Id": auth.appId,
    },
    body: JSON.stringify({
      request: {
        query: "дизайнер",
        limit: 1,
        offset: 0,
        location: { type: "region", region_id: SEARCH_REGIONS[0] },
        filters: { schedule_ids: [REMOTE_SCHEDULE_ID] },
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Работа.ру ${response.status}`);
  const payload = (await response.json()) as { response?: { vacancies?: unknown[] } };
  if (!Array.isArray(payload.response?.vacancies)) throw new Error("Работа.ру: пустой ответ");
}

export async function searchRabota(query: string, remoteOnly: boolean, now = new Date()): Promise<RabotaHit[]> {
  const auth = await ensureRabotaAccess();
  if (!auth) throw new Error("Rabota.ru: нет токена");
  const seen = new Set<string>();
  const hits: RabotaHit[] = [];
  for (const regionId of SEARCH_REGIONS) {
    const rows = await searchRegion(query, regionId, auth, now);
    for (const hit of rows) {
      if (remoteOnly && !hit.remote) continue;
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      hits.push(hit);
    }
  }
  return hits;
}
