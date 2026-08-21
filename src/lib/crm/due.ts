/** Даты следующего шага в часовом поясе Москвы. */

const MSK = "Europe/Moscow";

export function mskYmd(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MSK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Начало календарного дня МСК → Instant UTC. */
export function mskDayStartUtc(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+03:00`);
}

export function mskTodayBounds(now = new Date()) {
  const today = mskYmd(now);
  const start = mskDayStartUtc(today);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { today, start, end };
}

/** value из <input type="date"> → Date (полночь МСК). */
export function dateInputToNextStepAt(ymd: string | null | undefined): Date | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return mskDayStartUtc(ymd);
}

export function nextStepAtToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return mskYmd(new Date(iso));
}

export type DueKind = "today" | "overdue" | null;

export function dueKindFor(iso: string | null | undefined, now = new Date()): DueKind {
  if (!iso) return null;
  const at = new Date(iso).getTime();
  const { start, end } = mskTodayBounds(now);
  if (at < start.getTime()) return "overdue";
  if (at >= start.getTime() && at < end.getTime()) return "today";
  return null;
}

export function formatDueLabel(iso: string | null | undefined, now = new Date()): string | null {
  if (!iso) return null;
  const kind = dueKindFor(iso, now);
  const ymd = mskYmd(new Date(iso));
  if (kind === "overdue") return `просрочено · ${ymd}`;
  if (kind === "today") return `сегодня · ${ymd}`;
  return ymd;
}
