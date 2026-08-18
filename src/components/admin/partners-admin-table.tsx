"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  computeOnboardingSteps,
  onboardingProgress,
} from "@/lib/agent/onboarding-steps";
import PartnerAccessCardModal from "@/components/admin/partner-access-card";
import type { PartnerAccessCard } from "@/lib/admin/access-card";
import { PaidBadge } from "@/components/billing/paid-badge";

function QuotaBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const color = pct >= 100 ? "var(--red)" : pct >= 80 ? "var(--amber)" : "var(--green)";
  return (
    <div style={{ minWidth: 100 }}>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, marginBottom: 4 }}>
        {used} / {limit}
      </div>
      <div style={{ height: 6, background: "var(--bg-hover)", borderRadius: 3 }}>
        <div style={{ height: 6, width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

export default function PartnersAdminTable() {
  const [partners, setPartners] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [vpsIp, setVpsIp] = useState("");
  const [loading, setLoading] = useState(true);
  const [accessCard, setAccessCard] = useState<PartnerAccessCard | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/partners");
      const d = await r.json();
      setPartners(d.partners || []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function loginAs(email: string) {
    const res = await fetch("/api/admin/login-as", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const d = await res.json();
    if (d.ok) window.location.href = "/dashboard";
    else alert(d.error || "Ошибка");
  }

  async function renewMonth(email: string) {
    if (!confirm("Продлить месяц: сброс счётчика + включить сбор?")) return;
    await fetch("/api/admin/mark-paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    load();
  }

  async function saveVpsIp(sourceId: string) {
    await fetch("/api/admin/partners/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId, vpsIp }),
    });
    load();
  }

  async function openAccess(partnerId: string) {
    const r = await fetch(`/api/admin/partners/${partnerId}/secrets`);
    const d = await r.json();
    if (d.ok && d.accessCard) setAccessCard(d.accessCard);
    else alert(d.error || "Не удалось загрузить карточку");
  }

  if (loading) {
    return <p style={{ padding: 24, color: "var(--ink-muted)" }}>Загрузка…</p>;
  }

  if (partners.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
        <p style={{ color: "var(--ink-muted)", marginBottom: 16 }}>Партнёров ещё нет</p>
        <Link href="/dashboard/admin/new" style={{ color: "var(--accent)", fontWeight: 600 }}>+ Подключить первого</Link>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-surface)" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700 }}>Партнёры ({partners.length})</span>
        <Link href="/dashboard/admin/new" style={{ fontSize: "var(--text-sm)", color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
          + Подключить
        </Link>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th style={th}>Партнёр</th>
            <th style={th}>Лимит месяца</th>
            <th style={th}>Счёт</th>
            <th style={th}>Агент</th>
            <th style={th}>Сбор</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {partners.map((p) => {
            const ws = p.workspace;
            const source = ws?.sources?.[0];
            const sub = p.subscription;
            const used = sub?.leadsUsedMonth ?? 0;
            const limit = sub?.leadsPerMonth ?? 0;
            const billing = sub?.billing;
            const expires = sub?.expiresAt ? new Date(sub.expiresAt) : null;
            const expired = billing?.expired ?? (expires ? expires.getTime() < Date.now() : true);
            const online = source?.agentStatus?.online;
            const collectionOn = sub?.collectionEnabled && !expired && !billing?.paused && used < limit;
            const isOpen = expanded === p.id;

            const partnerInput = {
              email: p.email,
              name: p.name,
              workspace: ws
                ? {
                    leadsCount: ws.leadsCount || 0,
                    settings: ws.settings,
                    sources: ws.sources,
                  }
                : null,
            };
            const steps = computeOnboardingSteps(partnerInput);
            const progress = onboardingProgress(steps);

            return (
              <tbody key={p.id} style={{ display: "table-row-group" }}>
                <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={td}>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : p.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
                    >
                      <span style={{ fontWeight: 650 }}>{p.name || p.email}</span>
                      <br />
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{p.email}</span>
                      {progress < 100 && (
                        <span style={{ fontSize: "0.6rem", color: "var(--amber)", marginLeft: 6 }}>настройка {progress}%</span>
                      )}
                    </button>
                  </td>
                  <td style={td}>
                    {sub ? <QuotaBar used={used} limit={limit} /> : "—"}
                  </td>
                  <td style={{ ...td, fontSize: "var(--text-xs)", lineHeight: 1.45 }}>
                    {billing ? (
                      <>
                        <PaidBadge paid={!!billing.periodPaid} size="sm" />
                        <div style={{ marginTop: 4 }}>{billing.label}</div>
                        <div style={{ color: "var(--ink-muted)" }}>
                          VPS {billing.vpsDays} дн × {billing.vpsPerDayRub} = {billing.vpsCost.toLocaleString("ru-RU")} ₽
                        </div>
                        {!billing.unlimited && (
                          <div style={{ color: "var(--ink-muted)" }}>
                            к концу {billing.vpsCostAtEnd.toLocaleString("ru-RU")} ₽
                          </div>
                        )}
                        <div style={{ fontWeight: 700 }}>
                          {billing.periodPaid
                            ? `оплачен · начислено ${billing.accruedNow.toLocaleString("ru-RU")} ₽`
                            : `к оплате ${billing.dueNow.toLocaleString("ru-RU")} ₽`}
                        </div>
                      </>
                    ) : expires ? (
                      expired ? (
                        <span style={{ color: "var(--red)" }}>истёк {expires.toLocaleDateString("ru")}</span>
                      ) : (
                        expires.toLocaleDateString("ru")
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={td}>
                    <span style={{ color: online ? "var(--green)" : "var(--ink-muted)", fontSize: "var(--text-xs)" }}>
                      {online ? "online" : "offline"}
                    </span>
                  </td>
                  <td style={td}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 100,
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        background: collectionOn ? "var(--green-soft)" : "var(--red-soft)",
                        color: collectionOn ? "var(--green)" : "var(--red)",
                      }}
                    >
                      {collectionOn ? "вкл" : "стоп"}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => openAccess(p.id)} style={btn("var(--bg-hover)", "var(--ink-body)")}>
                        Доступ
                      </button>
                      <button type="button" onClick={() => loginAs(p.email)} style={btn("var(--accent-soft)", "var(--accent)")}>
                        Просмотр
                      </button>
                      <button type="button" onClick={() => renewMonth(p.email)} style={btn("var(--green-soft)", "var(--green)")}>
                        + месяц
                      </button>
                    </div>
                  </td>
                </tr>
                {isOpen && source && (
                  <tr>
                    <td colSpan={6} style={{ padding: "16px 20px", background: "var(--bg-layer)", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: 8 }}>Подключение VPS</p>
                          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                            <input
                              value={vpsIp || source.config?._vpsIp || ""}
                              onChange={(e) => setVpsIp(e.target.value)}
                              placeholder="IP VPS (159.194.213.198)"
                              style={{
                                flex: 1,
                                padding: "8px 12px",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--border)",
                                fontSize: "var(--text-sm)",
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => saveVpsIp(source.id)}
                              style={btn("var(--accent)", "#fff")}
                            >
                              Сохранить IP
                            </button>
                          </div>
                          {source.setupCommand && (
                            <code style={{ fontSize: "0.7rem", display: "block", padding: 10, background: "var(--bg-root)", borderRadius: 8, wordBreak: "break-all" }}>
                              {source.setupCommand}
                            </code>
                          )}
                        </div>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: 8 }}>Чеклист ({progress}%)</p>
                          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "var(--text-xs)" }}>
                            {steps.map((s) => (
                              <li key={s.id} style={{ padding: "4px 0", color: s.done ? "var(--green)" : "var(--ink-muted)" }}>
                                {s.done ? "✓" : "○"} {s.title}
                              </li>
                            ))}
                          </ul>
                          <p style={{ marginTop: 12, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                            Сроки, VPS-счётчик и вкл/выкл сбора — вкладка{" "}
                            <Link href="/dashboard/admin/billing" style={{ color: "var(--accent)" }}>Счета</Link>
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </tbody>
      </table>
      {accessCard && (
        <PartnerAccessCardModal card={accessCard} onClose={() => setAccessCard(null)} />
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)" };
const td: React.CSSProperties = { padding: "12px 16px", fontSize: "var(--text-sm)", verticalAlign: "top" };
const btn = (bg: string, clr: string): React.CSSProperties => ({
  padding: "4px 10px",
  borderRadius: "var(--radius-sm)",
  background: bg,
  color: clr,
  border: `1px solid ${clr === "#fff" ? "var(--accent)" : clr}`,
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  cursor: "pointer",
});
