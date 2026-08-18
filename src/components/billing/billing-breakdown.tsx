import type { BillingReport } from "@/lib/billing/operator-pricing";
import { formatRub } from "@/lib/billing/operator-pricing";
import { PaidStatusBlock } from "./paid-badge";

function ruDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU");
}

export function BillingBreakdown({
  b,
  compact,
}: {
  b: BillingReport;
  compact?: boolean;
}) {
  const vpsNow = `${b.vpsDays} дн × ${b.vpsPerDayRub} ₽ = ${formatRub(b.vpsCost)}`;
  const vpsEnd = `${b.vpsDaysAtEnd} дн × ${b.vpsPerDayRub} ₽ = ${formatRub(b.vpsCostAtEnd)}`;

  if (compact) {
    return (
      <div style={{ fontSize: "var(--text-xs)", lineHeight: 1.45 }}>
        <PaidStatusBlock b={b} />
        <div>
          {ruDate(b.periodStart)} — {b.unlimited ? "без срока" : ruDate(b.expiresAt)}
        </div>
        <div>VPS сейчас: {vpsNow}</div>
        {!b.unlimited && <div style={{ color: "var(--ink-muted)" }}>к концу: {vpsEnd}</div>}
        <div style={{ fontWeight: 700, marginTop: 4 }}>
          {b.periodPaid ? `начислено ${formatRub(b.accruedNow)} · к оплате 0 ₽` : `к оплате: ${formatRub(b.dueNow)}`}
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontSize: "var(--text-sm)", lineHeight: 1.55 }}>
      <PaidStatusBlock b={b} />
      <p style={{ margin: "0 0 8px", color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}>
        Подключение {ruDate(b.connectedAt)} · период {ruDate(b.periodStart)} —{" "}
        {b.unlimited ? "без остановки" : ruDate(b.expiresAt)}
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", maxWidth: 420 }}>
        <tbody>
          {b.connectFeeDue > 0 && (
            <tr>
              <td style={cell}>Подключение агента (разово)</td>
              <td style={num}>{formatRub(b.connectFeeDue)}</td>
            </tr>
          )}
          <tr>
            <td style={cell}>API агента ИИ (${b.aiApiUsd})</td>
            <td style={num}>{formatRub(b.aiApiRub)}</td>
          </tr>
          {b.supportDue > 0 && (
            <tr>
              <td style={cell}>Поддержка аккаунта</td>
              <td style={num}>{formatRub(b.supportDue)}</td>
            </tr>
          )}
          <tr>
            <td style={cell}>VPS сейчас</td>
            <td style={num}>{vpsNow}</td>
          </tr>
          {!b.unlimited && (
            <tr>
              <td style={cell}>VPS к концу периода</td>
              <td style={num}>{vpsEnd}</td>
            </tr>
          )}
          <tr>
            <td style={{ ...cell, fontWeight: 700 }}>Начислено сейчас</td>
            <td style={{ ...num, fontWeight: 700 }}>{formatRub(b.accruedNow)}</td>
          </tr>
          {!b.unlimited && (
            <tr>
              <td style={cell}>Начислено в конце периода</td>
              <td style={num}>{formatRub(b.accruedAtEnd)}</td>
            </tr>
          )}
          <tr>
            <td style={{ ...cell, fontWeight: 800 }}>К оплате</td>
            <td style={{ ...num, fontWeight: 800, color: b.periodPaid ? "var(--green)" : "var(--red)" }}>
              {formatRub(b.dueNow)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const cell: React.CSSProperties = {
  padding: "4px 12px 4px 0",
  color: "var(--ink-body)",
  fontSize: "var(--text-sm)",
};
const num: React.CSSProperties = {
  padding: "4px 0",
  textAlign: "right",
  whiteSpace: "nowrap",
  fontSize: "var(--text-sm)",
};
