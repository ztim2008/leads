"use client";
import { useState, useEffect } from "react";
import { Activity, Server, Database } from "lucide-react";

export default function CollectorStatus() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/admin/collectors").then(r => r.json()).then(setData).catch(() => {});
    const iv = setInterval(() => fetch("/api/admin/collectors").then(r => r.json()).then(setData).catch(() => {}), 30000);
    return () => clearInterval(iv);
  }, []);

  if (!data) return null;

  const { collectors, pm2, stats } = data;

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-surface)", marginBottom: 24 }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", fontWeight: 650, fontSize: "var(--text-sm)", display: "flex", alignItems: "center", gap: 8 }}>
        <Activity size={16} style={{ color: "var(--accent)" }} /> Коллекторы
        <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginLeft: "auto" }}>
          {stats?.today || 0} сегодня / {stats?.total || 0} всего
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 0 }}>
        {["leads-profi", "leads-kwork"].map(name => {
          const p = pm2?.[name] || {};
          const c = collectors?.[name.replace("leads-", "")] || {};
          const alive = p.status === "online";
          return (
            <div key={name} style={{ padding: "16px 20px", borderRight: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: alive ? "var(--green)" : "var(--red)", boxShadow: alive ? "0 0 6px var(--green)" : "none" }} />
                <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{name}</span>
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", lineHeight: 1.8 }}>
                <div>🔄 Рестартов: {p.restarts || 0}</div>
                <div>⏱ Uptime: {p.uptime ? Math.round(p.uptime / 60) + "m" : "?"}</div>
                <div>📊 Заявок: {c.totalLeads || 0}</div>
                <div>🕐 Last check: {c.lastCheck ? Math.round((Date.now() - new Date(c.lastCheck).getTime()) / 60000) + "m ago" : "?"}</div>
                {c.status && <div style={{ color: "var(--accent)" }}>📌 {c.status?.slice(0, 40)}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border)", fontSize: "var(--text-xs)", color: "var(--ink-muted)", display: "flex", gap: 20 }}>
        <span>🔵 Profi: {stats?.profi || 0}</span>
        <span>🟠 Kwork: {stats?.kwork || 0}</span>
      </div>
    </div>
  );
}
