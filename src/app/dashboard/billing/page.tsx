import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { formatRub } from "@/lib/billing/operator-pricing";
import { billingViewFor } from "@/lib/billing/view";
import { BillingBreakdown } from "@/components/billing/billing-breakdown";
import { PaymentCalendar } from "@/components/billing/payment-calendar";
import { PaidBadge } from "@/components/billing/paid-badge";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user) return null;

  const user = await db.user.findUnique({ where: { email: (session.user as { email?: string }).email } });
  if (!user) return null;

  const ws = await db.workspace.findFirst({ where: { userId: user.id } });
  if (!ws) return null;

  const sub = await db.subscription.findFirst({ where: { workspaceId: ws.id } });
  const view = sub ? await billingViewFor(sub, user.createdAt, ws.id) : null;
  const billing = view?.report || null;

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 4 }}>Счёт</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginBottom: 28, lineHeight: 1.5 }}>
        Оплата оператору вручную. Статус «оплачен / не оплачен» ставит оператор — вы видите то же самое.
        VPS считается каждый прожитый день. API агента ИИ — каждый месяц. Подключение — один раз, со второго месяца — поддержка аккаунта.
      </p>

      {!billing ? (
        <p style={{ color: "var(--ink-muted)" }}>Подписка ещё не создана. Обратитесь к оператору.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 640 }}>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-surface)",
              padding: 28,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <PaidBadge paid={billing.periodPaid} />
            </div>
            <p style={{ fontSize: "var(--text-3xl)", fontWeight: 800, marginBottom: 4, color: billing.periodPaid ? "var(--green)" : "var(--red)" }}>
              {formatRub(billing.dueNow)}
            </p>
            <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginBottom: 20 }}>
              {billing.periodPaid
                ? `оплачено · начислено за период ${formatRub(billing.accruedNow)}`
                : `не оплачен · к оплате сейчас${
                    !billing.unlimited && billing.accruedAtEnd !== billing.accruedNow
                      ? ` · в конце периода ${formatRub(billing.accruedAtEnd)}`
                      : ""
                  }`}
            </p>
            <BillingBreakdown b={billing} />
            <p style={{ marginTop: 24, fontSize: "var(--text-xs)", color: "var(--ink-muted)", lineHeight: 1.5 }}>
              Чтобы продлить срок или поставить паузу, напишите оператору.
            </p>
          </div>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-surface)",
              padding: 28,
            }}
          >
            <p style={{ fontWeight: 700, marginBottom: 12 }}>Календарь оплаты</p>
            <PaymentCalendar slots={view?.calendar || []} />
          </div>
        </div>
      )}
    </div>
  );
}
