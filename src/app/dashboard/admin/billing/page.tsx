"use client";

import { useEffect, useState } from "react";

interface PartnerRow {
  userId: string;
  email: string;
  name: string;
  workspaceId: string;
  profiLogin: string | null;
  sourceEnabled: boolean;
  agentOnline: boolean;
  quota: {
    used: number;
    limit: number;
    remaining: number;
    collectionEnabled: boolean;
    expiresAt: string | null;
    expired: boolean;
  } | null;
}

export default function BillingLimitsPage() {
  const [data, setData] = useState<{ partners: PartnerRow[]; summary: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/billing");
      if (r.ok) setData(await r.json());
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function action(workspaceId: string, action: string, extra?: Record<string, unknown>) {
    await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, action, ...extra }),
    });
    setMsg("✅ Обновлено");
    load();
    setTimeout(() => setMsg(""), 2500);
  }

  if (loading) return <p style={{ padding: 24, color: "var(--ink-muted)" }}>Загрузка…</p>;

  const partners = data?.partners || [];
  const summary = data?.summary || { total: 0, active: 0, paused: 0, nearLimit: 0 };

  return (
    <div>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginBottom: 20, lineHeight: 1.5 }}>
        Управление лимитами заявок на месяц. Нет фиксированной цены — вы вручную продлеваете период и задаёте лимит.
        При исчерпании лимита сбор останавливается, уведомление уходит в Telegram админу и партнёру.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <SummaryCard label="Всего" value={summary.total} />
        <SummaryCard label="Сбор активен" value={summary.active} color="var(--green)" />
        <SummaryCard label="Остановлено" value={summary.paused} color="var(--red)" />
        <SummaryCard label="Близко к лимиту" value={summary.nearLimit} color="var(--amber)" />
      </div>

      {msg && <p style={{ color: "var(--green)", fontSize: "var(--text-sm)", marginBottom: 12 }}>{msg}</p>}

      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-surface)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={th}>Партнёр</th>
              <th style={th}>Использовано</th>
              <th style={th}>Лимит</th>
              <th style={th}>До</th>
              <th style={th}>Сбор</th>
              <th style={th}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => {
              const q = p.quota;
              const pct = q && q.limit > 0 ? (q.used / q.limit) * 100 : 0;
              return (
                <tr key={p.workspaceId} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={td}>
                    <div style={{ fontWeight: 650 }}>{p.name}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{p.email}</div>
                    {p.profiLogin && <div style={{ fontSize: "0.65rem", color: "var(--ink-muted)" }}>Profi: {p.profiLogin}</div>}
                  </td>
                  <td style={td}>
                    <span style={{ fontWeight: 700, color: pct >= 100 ? "var(--red)" : pct >= 80 ? "var(--amber)" : "var(--ink-heading)" }}>
                      {q?.used ?? "—"}
                    </span>
                  </td>
                  <td style={td}>
                    <input
                      type="number"
                      defaultValue={q?.limit ?? 500}
                      style={inp}
                      onBlur={(e) => {
                        const v = parseInt(e.target.value) || 500;
                        if (v !== q?.limit) action(p.workspaceId, "set_limit", { leadsPerMonth: v });
                      }}
                    />
                  </td>
                  <td style={{ ...td, fontSize: "var(--text-xs)" }}>
                    {q?.expiresAt
                      ? new Date(q.expiresAt).toLocaleDateString("ru")
                      : "—"}
                    {q?.expired && <span style={{ color: "var(--red)" }}> истёк</span>}
                  </td>
                  <td style={td}>
                    <button
                      type="button"
                      onClick={() => action(p.workspaceId, "toggle", { enabled: !q?.collectionEnabled })}
                      style={{
                        padding: "4px 12px",
                        borderRadius: 100,
                        border: "none",
                        fontWeight: 600,
                        fontSize: "var(--text-xs)",
                        cursor: "pointer",
                        background: q?.collectionEnabled && !q?.expired ? "var(--green-soft)" : "var(--red-soft)",
                        color: q?.collectionEnabled && !q?.expired ? "var(--green)" : "var(--red)",
                      }}
                    >
                      {q?.collectionEnabled && !q?.expired ? "ВКЛ" : "СТОП"}
                    </button>
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => action(p.workspaceId, "renew")} style={actBtn}>
                        Продлить месяц
                      </button>
                      <button type="button" onClick={() => action(p.workspaceId, "reset_counter")} style={actBtn}>
                        Сброс счётчика
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ padding: "16px 20px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
      <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{label}</p>
      <p style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: color || "var(--ink-heading)" }}>{value}</p>
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)" };
const td: React.CSSProperties = { padding: "12px 16px", fontSize: "var(--text-sm)" };
const inp: React.CSSProperties = { width: 80, padding: "6px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: "var(--text-sm)" };
const actBtn: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  background: "var(--bg-layer)",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  cursor: "pointer",
};
