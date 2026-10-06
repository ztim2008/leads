import { mskClock, startOfMskDay } from "./time";

/** В ленту и в Telegram только если откликов не больше этого. Нет числа — не режем. */
export const FEW_RESPONSES = 3;

export function fewResponses(count: number | null | undefined): boolean {
  return count == null || count <= FEW_RESPONSES;
}

/** Опубликована сегодня по Москве. Вчерашние в новый день не входят. */
export function publishedToday(publishedAt: Date | null, now = new Date()): boolean {
  if (!publishedAt) return false;
  const ts = publishedAt.getTime();
  return ts >= startOfMskDay(now).getTime() && ts <= now.getTime() + 60_000;
}

/** Карточка в Telegram: опубликована сегодня и откликов не больше 3. */
export function worthInstantPush(input: {
  publishedAt: Date | null;
  firstSeenAt: Date;
  responsesCount: number | null | undefined;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  return publishedToday(input.publishedAt, now) && fewResponses(input.responsesCount);
}

export function canPushVacancy(input: {
  publishedAt: Date | null;
  firstSeenAt: Date;
  responsesCount: number | null | undefined;
  salaryFrom: number | null;
  salaryTo: number | null;
  now?: Date;
}): boolean {
  return worthInstantPush(input);
}

export function responsesLabel(count: number | null | undefined): string | null {
  if (count == null) return null;
  const n = Math.max(0, Math.round(count));
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word = "откликов";
  if (mod10 === 1 && mod100 !== 11) word = "отклик";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) word = "отклика";
  return `${n} ${word}`;
}

export const HIDE_REASONS = {
  role: "не та роль",
  pay: "мало денег",
  seen: "уже смотрел",
} as const;

export type HideReason = keyof typeof HIDE_REASONS;

export function hideReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return reason in HIDE_REASONS ? HIDE_REASONS[reason as HideReason] : null;
}

/** Окно 08:00–08:20 МСК, один раз за утро. */
export function shouldSendDigest(now: Date, lastDigestAt: Date | null): boolean {
  const clock = mskClock(now);
  if (clock.hour !== 8 || clock.minute >= 20) return false;
  if (!lastDigestAt) return true;
  const morning = new Date(`${clock.ymd}T08:00:00+03:00`);
  return lastDigestAt < morning;
}

/** Начало тихих часов, которые только что закончились. */
export function digestSince(now: Date, quietStart: string): Date {
  const clock = mskClock(now);
  const match = /^(\d{1,2}):(\d{2})$/.exec(quietStart.trim());
  const hour = match ? Number(match[1]) : 23;
  const minute = match ? Number(match[2]) : 0;
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const today = new Date(`${clock.ymd}T${hh}:${mm}:00+03:00`);
  if (clock.hour < 12) return new Date(today.getTime() - 24 * 60 * 60 * 1000);
  return today;
}
