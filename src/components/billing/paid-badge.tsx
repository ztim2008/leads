import type { BillingReport } from "@/lib/billing/operator-pricing";

export function PaidBadge({ paid, size = "md" }: { paid: boolean; size?: "sm" | "md" }) {
  const label = paid ? "оплачен" : "не оплачен";
  const pad = size === "sm" ? "3px 8px" : "6px 12px";
  const font = size === "sm" ? "0.65rem" : "var(--text-sm)";
  return (
    <span
      style={{
        display: "inline-block",
        padding: pad,
        borderRadius: 100,
        fontSize: font,
        fontWeight: 700,
        letterSpacing: 0.2,
        background: paid ? "var(--green-soft)" : "var(--red-soft)",
        color: paid ? "var(--green)" : "var(--red)",
      }}
    >
      {label}
    </span>
  );
}

export function PaidStatusBlock({ b }: { b: BillingReport }) {
  return (
    <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <PaidBadge paid={b.periodPaid} />
      <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{b.label}</span>
    </div>
  );
}
