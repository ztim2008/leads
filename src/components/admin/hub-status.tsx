"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

type Pm2Row = { status?: string; restarts?: number; uptime?: number; memory?: number };

export default function HubStatus() {
  const [data, setData] = useState<{
    pm2?: Record<string, Pm2Row>;
    hub?: { profiOnHub?: boolean; disabledSince?: string };
  } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/admin/collectors")
        .then((r) => r.json())
        .then(setData)
        .catch(() => {});
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);

  async function restart(action: "restart-server" | "restart-health", label: string) {
    setBusy(label);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/health-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await r.json();
      setMsg(d.message || d.error || "Готово");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "ошибка");
    }
    setBusy(null);
  }

  const procs = [
    { name: "leads-konversus", label: "Хаб Next.js" },
    { name: "leads-health", label: "Доктор / health" },
  ];

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        background: "var(--bg-surface)",
        marginBottom: 24,
      }}
    >
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          fontWeight: 650,
          fontSize: "var(--text-sm)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Activity size={16} style={{ color: "var(--accent)" }} /> Хаб
      </div>
      <div style={{ padding: "12px 20px", background: "var(--accent-soft)", fontSize: "var(--text-xs)", color: "var(--accent)" }}>
        Админ — оператор, не сборщик. Profi и Kwork на хабе не крутим. Свои заявки — только как партнёр (онбординг).
        {data?.hub?.profiOnHub === false ? ` Profi на хабе выкл с ${data.hub.disabledSince || "—"}.` : ""}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {procs.map((p) => {
          const row = data?.pm2?.[p.name] || {};
          const alive = row.status === "online";
          return (
            <div key={p.name} style={{ padding: "16px 20px", borderRight: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: alive ? "var(--green)" : "var(--red)",
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{p.label}</span>
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", lineHeight: 1.8 }}>
                <div>PM2: {row.status || "—"}</div>
                <div>Рестартов: {row.restarts ?? "—"}</div>
                <div>RAM: {row.memory != null ? `${row.memory} МБ` : "—"}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" disabled={!!busy} onClick={() => restart("restart-server", "Next.js")} style={btn}>
          {busy === "Next.js" ? "…" : "Рестарт Next.js"}
        </button>
        <button type="button" disabled={!!busy} onClick={() => restart("restart-health", "Health")} style={btn}>
          {busy === "Health" ? "…" : "Рестарт health"}
        </button>
        {msg && <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{msg}</span>}
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  background: "var(--bg-layer)",
  cursor: "pointer",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
};
