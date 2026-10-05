export type MskClock = { hour: number; minute: number; ymd: string };

export function mskClock(date = new Date()): MskClock {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export function startOfMskDay(date = new Date()): Date {
  return new Date(`${mskClock(date).ymd}T00:00:00+03:00`);
}

function clockMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Тихие часы. Интервал через полночь (23:00–08:00) поддерживается. */
export function inQuietHours(quietStart: string, quietEnd: string, date = new Date()): boolean {
  const start = clockMinutes(quietStart);
  const end = clockMinutes(quietEnd);
  if (start == null || end == null || start === end) return false;
  const now = mskClock(date);
  const mins = now.hour * 60 + now.minute;
  if (start < end) return mins >= start && mins < end;
  return mins >= start || mins < end;
}

export function hhTimestamp(date: Date): string {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return `${fmt.format(date).replace(" ", "T")}+0300`;
}

export type Freshness = { label: string; hot: boolean };

/**
 * «N минут назад» только если и публикация HH, и наш первый просмотр свежие.
 * Переопубликация недельной вакансии не становится «только что».
 */
export function freshness(publishedAt: Date | null, firstSeenAt: Date, now = new Date()): Freshness {
  const seenMin = (now.getTime() - firstSeenAt.getTime()) / 60000;
  const pubMin = publishedAt ? (now.getTime() - publishedAt.getTime()) / 60000 : null;
  if (pubMin != null && pubMin >= 0 && pubMin <= 45 && seenMin >= -1 && seenMin <= 45) {
    const mins = Math.max(1, Math.round(Math.min(pubMin, seenMin)));
    return { label: mins < 60 ? `${mins} мин назад` : "только что", hot: true };
  }
  if (pubMin != null && pubMin >= 0 && pubMin < 60) {
    return { label: `${Math.max(1, Math.round(pubMin))} мин назад`, hot: false };
  }
  if (pubMin != null && pubMin >= 0 && pubMin < 60 * 24) {
    const hours = Math.max(1, Math.round(pubMin / 60));
    return { label: `${hours} ч назад`, hot: false };
  }
  if (pubMin != null && pubMin >= 60 * 24) {
    const days = Math.round(pubMin / (60 * 24));
    return { label: `${days} дн назад`, hot: false };
  }
  return { label: "время публикации неизвестно", hot: false };
}
