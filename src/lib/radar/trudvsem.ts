import { startOfMskDay } from "./time";
import { norm, stripHtml } from "./text";

/**
 * Открытый API «Работа в России». Ключ не нужен.
 * Регион не передаём: выдача по всей стране.
 * Удалёнку API не фильтрует — её отмечаем по тексту.
 */

const API = "http://opendata.trudvsem.ru/api/v1/vacancies";

export type TrudHit = {
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

/** Удалёнка в тексте. «Удаленная промплощадка» и «не удаленная работа» не считаются. */
export function textSaysRemote(text: string): boolean {
  const cleaned = norm(text)
    .replace(/не\s+является\s+удален\w*/g, " ")
    .replace(/не\s+удален\w*/g, " ")
    .replace(/не\s+дистанцион\w*/g, " ");
  return (
    /удаленн?(ая|ой|ую|ый|ое|ые|о)?\s+(работ|занят|формат)/.test(cleaned) ||
    /удаленк/.test(cleaned) ||
    /удаленно(?![а-я])/.test(cleaned) ||
    /дистанцион/.test(cleaned) ||
    /из дома/.test(cleaned) ||
    /\bremote\b/.test(cleaned)
  );
}

export function trudPublishedAt(creationDate: string, now = new Date()): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(creationDate.trim());
  if (!match) return null;
  const published = new Date(`${match[1]}T12:00:00+03:00`);
  if (Number.isNaN(published.getTime())) return null;
  const start = startOfMskDay(now).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  if (published.getTime() < start || published.getTime() >= end) return null;
  return published;
}

export function parseTrudvsemVacancies(payload: unknown, now = new Date()): TrudHit[] {
  const root = asRecord(payload);
  const results = asRecord(root?.results);
  const rows = Array.isArray(results?.vacancies) ? results.vacancies : [];
  const hits: TrudHit[] = [];
  for (const row of rows) {
    const wrap = asRecord(row);
    const vacancy = asRecord(wrap?.vacancy) || wrap;
    if (!vacancy) continue;
    const id = textOf(vacancy.id);
    const title = textOf(vacancy["job-name"]);
    if (!id || !title) continue;
    const publishedAt = trudPublishedAt(textOf(vacancy["creation-date"]), now);
    if (!publishedAt) continue;
    const company = asRecord(vacancy.company);
    const companyCode = textOf(company?.companycode) || "company";
    const region = asRecord(vacancy.region);
    const duty = stripHtml(textOf(vacancy.duty));
    const requirements = stripHtml(textOf(vacancy.requirements));
    const qualification = stripHtml(textOf(vacancy.qualification));
    const schedule = textOf(vacancy.schedule);
    const description = [duty, requirements, qualification].filter(Boolean).join("\n\n");
    const remote = textSaysRemote(`${title}\n${schedule}\n${description}`);
    const salaryFrom = money(vacancy.salary_min);
    const salaryToRaw = money(vacancy.salary_max);
    const url =
      textOf(vacancy.vac_url) ||
      `https://trudvsem.ru/vacancy/card/${encodeURIComponent(companyCode)}/${encodeURIComponent(id)}`;
    hits.push({
      id: `${companyCode}/${id}`.slice(0, 180),
      title,
      url,
      company: textOf(company?.name) || null,
      companyUrl: textOf(company?.url) || null,
      salaryFrom,
      salaryTo: salaryToRaw != null && salaryFrom != null && salaryToRaw < salaryFrom ? null : salaryToRaw,
      salaryCurrency: salaryFrom != null || salaryToRaw != null ? "RUR" : null,
      area: textOf(region?.name) || null,
      remote,
      employment: schedule || null,
      publishedAt,
      description,
    });
  }
  return hits;
}

export async function searchTrudvsem(query: string, now = new Date()): Promise<TrudHit[]> {
  const modifiedFrom = startOfMskDay(now).toISOString().replace(/\.\d{3}Z$/, "Z");
  const hits: TrudHit[] = [];
  let offset = 0;
  for (let page = 0; page < 2; page += 1) {
    const params = new URLSearchParams({
      text: query,
      modifiedFrom,
      limit: "100",
      offset: String(offset),
    });
    const response = await fetch(`${API}?${params}`, {
      headers: { Accept: "application/json", "User-Agent": "KonversusJobRadar/1.0" },
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`trudvsem ${response.status}`);
    const payload = (await response.json()) as { meta?: { total?: number }; results?: { vacancies?: unknown[] } };
    hits.push(...parseTrudvsemVacancies(payload, now));
    const received = payload.results?.vacancies?.length ?? 0;
    const total = Number(payload.meta?.total ?? 0);
    offset += 100;
    if (received < 100 || offset >= total || offset >= 200) break;
  }
  return hits;
}
