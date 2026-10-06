import { mskClock } from "./time";

/** Мгновенный пуш «горячей» вакансии, если откликов ещё мало. Нет числа — не режем. */
export const FEW_RESPONSES = 5;

/** Свежая для пуша: опубликована не старше этого срока. */
export const PUSH_MAX_AGE_MS = 10 * 24 * 60 * 60 * 1000;

/** Пуш за последние дни, если откликов не слишком много. Нет числа — не режем. */
export const PUSH_MAX_RESPONSES = 500;

export function fewResponses(count: number | null | undefined): boolean {
  return count == null || count <= FEW_RESPONSES;
}

/**
 * Карточка в Telegram: горячая с малым числом откликов
 * или опубликованная за последние 10 дней и откликов не больше 500.
 */
export function worthInstantPush(input: {
  publishedAt: Date | null;
  firstSeenAt: Date;
  responsesCount: number | null | undefined;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  const seenMin = (now.getTime() - input.firstSeenAt.getTime()) / 60000;
  const pubMin = input.publishedAt ? (now.getTime() - input.publishedAt.getTime()) / 60000 : null;
  const hot = pubMin != null && pubMin >= 0 && pubMin <= 45 && seenMin >= -1 && seenMin <= 45;
  if (hot && fewResponses(input.responsesCount)) return true;
  if (!input.publishedAt) return false;
  const age = now.getTime() - input.publishedAt.getTime();
  if (age < 0 || age > PUSH_MAX_AGE_MS) return false;
  return input.responsesCount == null || input.responsesCount <= PUSH_MAX_RESPONSES;
}

/** Без зарплаты пуш только при малом числе откликов. С зарплатой — обычное окно. */
export function canPushVacancy(input: {
  publishedAt: Date | null;
  firstSeenAt: Date;
  responsesCount: number | null | undefined;
  salaryFrom: number | null;
  salaryTo: number | null;
  now?: Date;
}): boolean {
  if (!worthInstantPush(input)) return false;
  const hasSalary = input.salaryFrom != null || input.salaryTo != null;
  if (hasSalary) return true;
  return fewResponses(input.responsesCount);
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
