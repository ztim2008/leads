"use client";
import { useState, useEffect } from "react";
import { Activity } from "lucide-react";

const COLLECTORS = [
  { name: "leads-kwork", key: "kwork", label: "Kwork", hubOnly: true },
  { name: "leads-health", key: "health", label: "Health", hubOnly: true },
];

export default function CollectorStatus() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const load = () => fetch("/api/admin/collectors").then((r) => r.json()).then(setData).catch(() => {});
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  if (!data) return null;

  const { collectors, pm2, stats, hub } = data;

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-surface)", marginBottom: 24 }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", fontWeight: 650, fontSize: "var(--text-sm)", display: "flex", alignItems: "center", gap: 8 }}>
        <Activity size={16} style={{ color: "var(--accent)" }} /> Коллекторы хаба
        <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginLeft: "auto" }}>
          {stats?.today || 0} сегодня / {stats?.total || 0} всего
        </span>
      </div>

      {hub && !hub.profiOnHub && (
        <div style={{ padding: "12px 20px", background: "var(--amber-soft)", borderBottom: "1px solid var(--border)", fontSize: "var(--text-xs)", color: "var(--amber)" }}>
          🛡 Profi на хабе отключён с {hub.disabledSince}. Сбор Profi — только через VPS-агент партнёра.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 0 }}>
        {COLLECTORS.map(({ name, key, label }) => {
          const p = pm2?.[name] || {};
          const c = collectors?.[key] || {};
          const alive = p.status === "online";
          return (
            <div key={name} style={{ padding: "16px 20px", borderRight: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: alive ? "var(--green)" : "var(--red)", boxShadow: alive ? "0 0 6px var(--green)" : "none" }} />
                <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{label}</span>
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", lineHeight: 1.8 }}>
                <div>PM2: {p.status || "—"}</div>
                <div>🔄 Рестартов: {p.restarts || 0}</div>
                <div>⏱ Uptime: {p.uptime ? Math.round(p.uptime / 60) + "m" : "?"}</div>
                {c.totalLeads != null && <div>📊 Заявок: {c.totalLeads}</div>}
                {c.lastCheck && <div>🕐 Last check: {Math.round((Date.now() - new Date(c.lastCheck).getTime()) / 60000) + "m ago"}</div>}
                {c.status && <div style={{ color: "var(--accent)" }}>📌 {String(c.status).slice(0, 40)}</div>}
              </div>
            </div>
          );
        })}
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ink-muted)" }} />
            <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>Profi</span>
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", lineHeight: 1.8 }}>
            <div>🚫 Не на хабе</div>
            <div>→ VPS-агент партнёра</div>
            <div>📊 В БД: {stats?.profi || 0}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border)", fontSize: "var(--text-xs)", color: "var(--ink-muted)", display: "flex", gap: 20 }}>
        <span>🔵 Profi (история): {stats?.profi || 0}</span>
        <span>🟠 Kwork: {stats?.kwork || 0}</span>
      </div>
    </div>
  );
}
