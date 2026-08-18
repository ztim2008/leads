"use client";

import { useEffect, useState } from "react";
import type { BillingReport, OperatorPriceSheet } from "@/lib/billing/operator-pricing";
import { formatRub, DEFAULT_PRICES } from "@/lib/billing/operator-pricing";
import type { CalendarSlot } from "@/lib/billing/payment-calendar";
import { BillingBreakdown } from "@/components/billing/billing-breakdown";
import { PaymentCalendar } from "@/components/billing/payment-calendar";
import { PaidBadge } from "@/components/billing/paid-badge";
import { PriceFields } from "@/components/billing/price-fields";

interface PartnerRow {
  userId: string;
  email: string;
  name: string;
  workspaceId: string;
  connectedAt: string;
  profiLogin: string | null;
  sourceEnabled: boolean;
  agentOnline: boolean;
  plan: string;
  status: string;
  quota: {
    used: number;
    limit: number;
    remaining: number;
    collectionEnabled: boolean;
    expiresAt: string | null;
    expired: boolean;
  } | null;
  billing: BillingReport | null;
  calendar: CalendarSlot[];
  prices: OperatorPriceSheet | null;
  periodIndex: number;
}

export default function BillingLimitsPage() {
  const [data, setData] = useState<{
    partners: PartnerRow[];
    summary: { total: number; active: number; paused: number; dueSum: number };
    defaults: OperatorPriceSheet;
  } | null>(null);
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

  async function action(workspaceId: string, actionName: string, extra?: Record<string, unknown>) {
    await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, action: actionName, ...extra }),
    });
    setMsg("Обновлено");
    load();
    setTimeout(() => setMsg(""), 2500);
  }

  async function saveDefaults(next: OperatorPriceSheet) {
    await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_defaults", ...next }),
    });
    setMsg("Шаблон цен сохранён");
    load();
    setTimeout(() => setMsg(""), 2500);
  }

  async function applyDefaultsToAll() {
    if (!confirm("Прописать эти цены всем текущим партнёрам? Уже отмеченные оплаты не сбросятся.")) return;
    await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "apply_defaults" }),
    });
    setMsg("Цены применены всем");
    load();
    setTimeout(() => setMsg(""), 2500);
  }

  if (loading) return <p style={{ padding: 24, color: "var(--ink-muted)" }}>Загрузка…</p>;

  const partners = data?.partners || [];
  const summary = data?.summary || { total: 0, active: 0, paused: 0, dueSum: 0 };
  const defaults = data?.defaults || DEFAULT_PRICES;

  return (
    <div>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginBottom: 20, lineHeight: 1.5 }}>
        Первый месяц: подключение разово + API ИИ + VPS по дням. Со второго месяца вместо подключения идёт поддержка аккаунта.
        Цены меняете здесь: шаблон для новых и отдельно у каждого партнёра. Флажок «оплачен / не оплачен» один и тот же у вас и у клиента.
      </p>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-surface)",
          padding: 20,
          marginBottom: 20,
        }}
      >
        <p style={{ fontWeight: 700, marginBottom: 4 }}>Цены по умолчанию</p>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 12 }}>
          Для новых подключений. Уже созданным партнёрам — кнопка «прописать всем» или поля в карточке ниже.
        </p>
        <PriceFields values={defaults} onSave={saveDefaults} saveLabel="Сохранить шаблон" />
        <button
          type="button"
          onClick={applyDefaultsToAll}
          style={{
            marginTop: 8,
            padding: "6px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            background: "transparent",
            fontSize: "var(--text-xs)",
            cursor: "pointer",
            color: "var(--ink-muted)",
          }}
        >
          Прописать эти цены всем партнёрам
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <SummaryCard label="Всего" value={String(summary.total)} />
        <SummaryCard label="Сбор активен" value={String(summary.active)} color="var(--green)" />
        <SummaryCard label="Пауза / стоп" value={String(summary.paused)} color="var(--red)" />
        <SummaryCard label="К оплате сейчас" value={formatRub(summary.dueSum)} color="var(--accent)" />
      </div>

      {msg && <p style={{ color: "var(--green)", fontSize: "var(--text-sm)", marginBottom: 12 }}>{msg}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {partners.map((p) => {
          const q = p.quota;
          const b = p.billing;
          return (
            <div
              key={p.workspaceId}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                background: "var(--bg-surface)",
                padding: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{p.email}</div>
                  {p.profiLogin && (
                    <div style={{ fontSize: "0.65rem", color: "var(--ink-muted)" }}>Profi: {p.profiLogin}</div>
                  )}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", textAlign: "right" }}>
                  заявки {q?.used ?? "—"} / {q?.limit ?? "—"}
                  <div>
                    агент {p.agentOnline ? "online" : "offline"} · сбор{" "}
                    {q?.collectionEnabled && !b?.expired && !b?.paused ? "вкл" : "выкл"}
                  </div>
                </div>
              </div>

              {b ? <BillingBreakdown b={b} /> : <p style={{ color: "var(--ink-muted)" }}>Нет подписки</p>}

              {p.prices && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontWeight: 650, fontSize: "var(--text-sm)", marginBottom: 8 }}>
                    Цены этого партнёра · период {p.periodIndex}
                    {b?.firstPeriod ? " (первый месяц — без поддержки)" : " (поддержка включена)"}
                  </p>
                  <PriceFields
                    values={p.prices}
                    onSave={(next) => action(p.workspaceId, "set_prices", next)}
                    saveLabel="Сохранить цены партнёра"
                  />
                </div>
              )}

              {b && (
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 14,
                    padding: "10px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-layer)",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "var(--text-sm)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={b.periodPaid}
                    onChange={(e) => action(p.workspaceId, "set_paid", { paid: e.target.checked })}
                  />
                  <PaidBadge paid={b.periodPaid} />
                  <span>{b.periodPaid ? "Снять оплату" : "Отметить оплаченным"}</span>
                </label>
              )}

              {p.calendar?.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <p style={{ fontWeight: 700, fontSize: "var(--text-sm)", marginBottom: 10 }}>Календарь оплаты</p>
                  <PaymentCalendar
                    slots={p.calendar}
                    interactive
                    onTogglePaid={(slot, paid) =>
                      action(p.workspaceId, "set_paid", { paid, periodStart: slot.periodStart })
                    }
                  />
                </div>
              )}

              <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  type="number"
                  defaultValue={q?.limit ?? 500}
                  title="Лимит заявок / месяц"
                  style={inp}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value) || 500;
                    if (v !== q?.limit) action(p.workspaceId, "set_limit", { leadsPerMonth: v });
                  }}
                />
                <button
                  type="button"
                  onClick={() => action(p.workspaceId, "toggle", { enabled: !q?.collectionEnabled })}
                  style={pill(Boolean(q?.collectionEnabled && !q?.expired && !b?.paused))}
                >
                  {q?.collectionEnabled && !b?.paused ? "Стоп сбора" : "Вкл сбор"}
                </button>
                {b?.paused ? (
                  <button
                    type="button"
                    onClick={() => action(p.workspaceId, "resume")}
                    style={actBtn}
                  >
                    Снять паузу
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Пауза: срок и счётчик VPS замирают, сбор выключается. Продолжить?")) {
                        action(p.workspaceId, "pause");
                      }
                    }}
                    style={actBtn}
                  >
                    Пауза
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        "Продлить месяц (оплачено): новый период 30 дней, счётчик VPS с нуля, подключение считается оплаченным.",
                      )
                    ) {
                      action(p.workspaceId, "renew");
                    }
                  }}
                  style={actBtn}
                >
                  Продлить (оплачено)
                </button>
                {!b?.unlimited && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Без остановки: срок не истечёт, VPS продолжает капать каждый день. Сбор остаётся включён.")) {
                        action(p.workspaceId, "unlimited");
                      }
                    }}
                    style={actBtn}
                  >
                    Без остановки
                  </button>
                )}
                <button type="button" onClick={() => action(p.workspaceId, "reset_counter")} style={actBtn}>
                  Сброс заявок
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: "16px 20px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
      <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{label}</p>
      <p style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: color || "var(--ink-heading)" }}>{value}</p>
    </div>
  );
}

function pill(on: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 100,
    border: "none",
    fontWeight: 600,
    fontSize: "var(--text-xs)",
    cursor: "pointer",
    background: on ? "var(--green-soft)" : "var(--red-soft)",
    color: on ? "var(--green)" : "var(--red)",
  };
}

const inp: React.CSSProperties = {
  width: 88,
  padding: "6px 8px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  fontSize: "var(--text-sm)",
};
const actBtn: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  background: "var(--bg-layer)",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  cursor: "pointer",
};
