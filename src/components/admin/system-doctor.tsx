"use client";

import { useCallback, useEffect, useState } from "react";

type Level = "ok" | "warn" | "call_agent";

type Finding = {
  id: string;
  level: Level;
  title: string;
  detail: string;
  heal?: string;
};

type Report = {
  at: string;
  level: Level;
  headline: string;
  nextStep: string;
  findings: Finding[];
  systems: {
    hub: { ok: boolean; http: number | null; profiOnHub: boolean };
    db: boolean;
    telegram: boolean;
    pm2: Record<string, { status: string; restarts?: number; memoryMb?: number }>;
    fleet: {
      total: number;
      online: number;
      offlineWork: number;
      offlineSleep: number;
      cbBad: number;
      activeErrors: number;
      leadsToday: number;
    };
  };
};

const THEME: Record<Level, { bg: string; fg: string; label: string }> = {
  ok: { bg: "var(--green-soft)", fg: "var(--green)", label: "ОК" },
  warn: { bg: "#f59e0b14", fg: "var(--amber)", label: "Внимание" },
  call_agent: { bg: "var(--red-soft)", fg: "var(--red)", label: "Зови агента" },
};

export default function SystemDoctor() {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/doctor");
      if (r.ok) setReport(await r.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function heal() {
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch("/api/admin/doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "heal" }),
      });
      const d = await r.json();
      if (!r.ok) {
        setNote(d.error || "не вылечил");
      } else {
        setNote(
          d.healed?.length
            ? `Вылечил: ${d.healed.join(", ")}`
            : "Лечить было нечего (или только то, что агенту)",
        );
        if (d.after) setReport(d.after);
        else await load();
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "ошибка");
    }
    setBusy(false);
  }

  if (!report) {
    return <p style={{ color: "var(--ink-muted)", marginBottom: 16 }}>Доктор смотрит систему…</p>;
  }

  const t = THEME[report.level];
  const f = report.systems.fleet;
  const chips = [
    { k: "Хаб", v: report.systems.hub.ok ? "200" : String(report.systems.hub.http ?? "↓"), ok: report.systems.hub.ok },
    { k: "БД", v: report.systems.db ? "ok" : "↓", ok: report.systems.db },
    { k: "TG", v: report.systems.telegram ? "ok" : "↓", ok: report.systems.telegram },
    { k: "Агенты", v: `${f.online}/${f.total} online`, ok: f.offlineWork === 0 },
    { k: "CB", v: f.cbBad ? `${f.cbBad} ≠ CLOSED` : "CLOSED", ok: f.cbBad === 0 },
    { k: "Сегодня", v: String(f.leadsToday), ok: true },
  ];

  return (
    <div
      style={{
        border: `1.5px solid ${t.fg}`,
        borderRadius: "var(--radius-lg)",
        background: t.bg,
        padding: 16,
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "0.7rem", fontWeight: 800, letterSpacing: 0.4, color: t.fg, marginBottom: 4 }}>
            🩺 ДОКТОР · {t.label}
          </div>
          <div style={{ fontSize: "var(--text-base)", fontWeight: 800, color: "var(--ink-heading)" }}>{report.headline}</div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-body)", marginTop: 4 }}>{report.nextStep}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => load()} style={btn}>
            Обновить
          </button>
          <button type="button" onClick={heal} disabled={busy} style={{ ...btn, fontWeight: 700 }}>
            {busy ? "Лечу…" : "Вылечить безопасное"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {chips.map((c) => (
          <span
            key={c.k}
            style={{
              fontSize: "0.7rem",
              fontWeight: 650,
              padding: "4px 8px",
              borderRadius: 8,
              background: "var(--bg-surface)",
              color: c.ok ? "var(--ink-body)" : "var(--red)",
            }}
          >
            {c.k}: {c.v}
          </span>
        ))}
      </div>

      {report.findings.length > 0 && (
        <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
          {report.findings.map((fnd) => (
            <li
              key={fnd.id}
              style={{
                fontSize: "var(--text-xs)",
                padding: "6px 0",
                borderTop: "1px solid var(--border-light)",
                color: fnd.level === "call_agent" ? "var(--red)" : fnd.level === "warn" ? "var(--amber)" : "var(--ink-body)",
              }}
            >
              <strong>{fnd.title}</strong>
              <span style={{ color: "var(--ink-muted)" }}> — {fnd.detail}</span>
            </li>
          ))}
        </ul>
      )}

      <p style={{ fontSize: "0.65rem", color: "var(--ink-muted)", marginTop: 10 }}>
        Автодоктор (leads-health) каждые 5 мин: сброс архивных ошибок, рестарт health если упал. Не трогает Profi/VPS/CB.
        {note ? ` · ${note}` : ""}
      </p>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
  cursor: "pointer",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
};
