import {
  PERIOD_DAYS,
  addDays,
  type BillingReport,
} from "./operator-pricing";

export type InvoiceSnap = {
  periodStart: Date | string;
  periodEnd: Date | string;
  amountRub: number;
  paid: boolean;
  paidAt: Date | string | null;
};

export type CalendarSlot = {
  periodStart: string;
  periodEnd: string;
  role: "past" | "current" | "upcoming";
  paid: boolean;
  paidAt: string | null;
  amountRub: number;
  title: string;
};

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

function iso(d: Date): string {
  return d.toISOString();
}

function samePeriod(a: Date, b: Date): boolean {
  return Math.abs(a.getTime() - b.getTime()) < 60 * 1000;
}

function ruRange(from: Date, to: Date): string {
  const f = from.toLocaleDateString("ru-RU");
  const t = to.toLocaleDateString("ru-RU");
  return `${f} — ${t}`;
}

export function buildPaymentCalendar(input: {
  connectedAt: Date;
  periodStart: Date;
  expiresAt: Date | null;
  report: BillingReport;
  invoices?: InvoiceSnap[];
  now?: Date;
  upcomingCount?: number;
}): CalendarSlot[] {
  const now = input.now ?? new Date();
  const invoices = (input.invoices || []).map((inv) => ({
    periodStart: toDate(inv.periodStart),
    periodEnd: toDate(inv.periodEnd),
    amountRub: inv.amountRub,
    paid: inv.paid,
    paidAt: inv.paidAt ? toDate(inv.paidAt) : null,
  }));
  const findInv = (start: Date) => invoices.find((inv) => samePeriod(inv.periodStart, start));

  const currentStart = input.periodStart;
  const currentEnd = input.expiresAt || addDays(currentStart, PERIOD_DAYS);
  const estimateMonth = input.report.supportFeeRub + input.report.aiApiRub + input.report.vpsPerDayRub * PERIOD_DAYS;
  const slots: CalendarSlot[] = [];

  let cursor = input.connectedAt;
  let guard = 0;
  while (cursor.getTime() + 12 * 60 * 60 * 1000 < currentStart.getTime() && guard < 36) {
    const end = addDays(cursor, PERIOD_DAYS);
    const inv = findInv(cursor);
    slots.push({
      periodStart: iso(cursor),
      periodEnd: iso(end),
      role: "past",
      paid: inv?.paid ?? false,
      paidAt: inv?.paidAt?.toISOString() || null,
      amountRub: inv?.amountRub ?? estimateMonth,
      title: ruRange(cursor, end),
    });
    cursor = end;
    guard += 1;
  }

  const currentInv = findInv(currentStart);
  slots.push({
    periodStart: iso(currentStart),
    periodEnd: iso(currentEnd),
    role: "current",
    paid: input.report.periodPaid,
    paidAt: input.report.periodPaidAt,
    amountRub: currentInv?.paid
      ? currentInv.amountRub
      : input.report.periodPaid
        ? input.report.accruedNow
        : input.report.accruedNow,
    title: ruRange(currentStart, currentEnd),
  });

  const upcomingCount = input.upcomingCount ?? 2;
  let nextStart = currentEnd;
  for (let i = 0; i < upcomingCount; i++) {
    const nextEnd = addDays(nextStart, PERIOD_DAYS);
    const inv = findInv(nextStart);
    slots.push({
      periodStart: iso(nextStart),
      periodEnd: iso(nextEnd),
      role: "upcoming",
      paid: inv?.paid ?? false,
      paidAt: inv?.paidAt?.toISOString() || null,
      amountRub: inv?.amountRub ?? estimateMonth,
      title: ruRange(nextStart, nextEnd),
    });
    nextStart = nextEnd;
  }

  void now;
  return slots;
}
