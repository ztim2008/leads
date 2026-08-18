import { db } from "@/lib/db";
import { reportFromSub, type BillingReport } from "./operator-pricing";
import { buildPaymentCalendar, type CalendarSlot, type InvoiceSnap } from "./payment-calendar";

export async function billingViewFor(
  sub: Parameters<typeof reportFromSub>[0] & { workspaceId?: string | null },
  connectedAt: Date,
  workspaceId?: string | null,
): Promise<{ report: BillingReport; calendar: CalendarSlot[] }> {
  const report = reportFromSub(sub, connectedAt);
  const wsId = workspaceId || sub.workspaceId;
  let invoices: InvoiceSnap[] = [];
  if (wsId) {
    const rows = await db.billingInvoice.findMany({
      where: { workspaceId: wsId },
      orderBy: { periodStart: "asc" },
    });
    invoices = rows.map((r) => ({
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      amountRub: r.amountRub,
      paid: r.paid,
      paidAt: r.paidAt,
    }));
  }
  const periodStart = sub.periodStart || sub.quotaPeriodStart || sub.createdAt;
  const calendar = buildPaymentCalendar({
    connectedAt,
    periodStart,
    expiresAt: sub.expiresAt,
    report,
    invoices,
  });
  return { report, calendar };
}
