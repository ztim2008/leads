"use client";

import { useState, useEffect } from "react";
import { Activity, RefreshCw } from "lucide-react";

const PROTECTION_LEVELS: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  light: { label: "Light", icon: "🛡️", color: "#22c55e", desc: "Ротация UA, шифрование ввода" },
  balanced: { label: "Balanced", icon: "⚔️", color: "#3b82f6", desc: "Мышь, поведение, паузы" },
  stealth: { label: "Stealth", icon: "🕵️", color: "#8b5cf6", desc: "60% пропусков, макс. защита" },
};

function ProtectionBadge({ mode }: { mode: string }) {
  const p = PROTECTION_LEVELS[mode] || { label: mode, icon: "❓", color: "#6b7280", desc: "" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 100, fontSize: "var(--text-xs)", fontWeight: 600, background: `${p.color}18`, color: p.color, border: `1px solid ${p.color}30` }} title={p.desc}>
      {p.icon} {p.label}
    </span>
  );
}

function StatusBar({ hub, sources, workspaces }: { hub: any; sources: any[]; workspaces: any[] }) {
  const profiOnHub = hub?.profiOnHub === true;
  const hasLeadsToday = workspaces?.some((w: any) => w.today > 0);
  const enabledSources = sources?.filter((s: any) => s.enabled) || [];

  let statusEmoji = "🟢";
  let statusText = "Хаб работает";
  let statusColor = "var(--green)";
  let statusBg = "var(--green-soft)";

  if (!profiOnHub) {
    statusEmoji = "🛡️";
    statusText = "Profi на хабе отключён (VPS-агенты)";
    statusColor = "var(--accent)";
    statusBg = "var(--accent-soft)";
  } else if (enabledSources.length === 0) {
    statusEmoji = "🟡";
    statusText = "Нет активных источников";
    statusColor = "var(--amber)";
    statusBg = "var(--amber-soft)";
  } else if (!hasLeadsToday) {
    statusEmoji = "🟡";
    statusText = "Сегодня заявок пока нет";
    statusColor = "var(--amber)";
    statusBg = "var(--amber-soft)";
  }

  return (
    <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)", background: statusBg }}>
      <span style={{ fontSize: 20 }}>{statusEmoji}</span>
      <span style={{ fontWeight: 700, color: statusColor, fontSize: "var(--text-sm)" }}>{statusText}</span>
      {hub?.policy && (
        <span style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)", maxWidth: 420 }}>
          · {hub.policy.slice(0, 80)}…
        </span>
      )}
    </div>
  );
}

export default function HealthCheckWidget() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [restarting, setRestarting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function check() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/health-check");
      if (res.ok) setHealth(await res.json());
    } catch {}
    setLoading(false);
  }

  async function doAction(action: string, label: string) {
    setRestarting(label);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/health-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      setMessage(data.message || data.error || "Готово");
      setTimeout(check, 3000);
    } catch (e: any) {
      setMessage("Ошибка: " + e.message);
    }
    setRestarting(null);
  }

  useEffect(() => {
    check();
  }, []);

  const hub = health?.hub;
  const sources = health?.sources || [];
  const workspaces = health?.workspaces || [];
  const summary = health?.summary || { today: 0, total: 0 };
  const collectors = health?.collectors || {};

  const restartBtn = (action: string, label: string, color: string) => (
    <button
      onClick={() => doAction(action, label)}
      disabled={restarting !== null}
      style={{
        padding: "6px 12px",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        border: `1px solid ${color}`,
        background: `${color}12`,
        color: color,
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: 4,
        opacity: restarting !== null ? 0.6 : 1,
      }}
    >
      {restarting === label ? "⏳" : "🔄"} {restarting === label ? "..." : label}
    </button>
  );

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-surface)", marginBottom: 24 }}>
      <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Activity size={18} style={{ color: "var(--accent)" }} />
          <span style={{ fontWeight: 650, fontSize: "var(--text-sm)" }}>
            {loading ? "⏳ Проверка..." : "🩺 Состояние системы"}
          </span>
          {summary && (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
              · {summary.today} сегодня / {summary.total} всего
            </span>
          )}
        </div>
        <button onClick={check} disabled={loading} style={{ background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "4px 10px", cursor: "pointer", color: "var(--ink-muted)", display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-xs)" }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Обновить
        </button>
      </div>

      {health && <StatusBar hub={hub} sources={sources} workspaces={workspaces} />}

      {health && (
        <div style={{ padding: "14px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, fontSize: "var(--text-xs)" }}>
          <div style={{ padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "var(--bg-layer)" }}>
            <p style={{ fontWeight: 600, marginBottom: 4, color: "var(--ink-muted)" }}>🏠 Хаб</p>
            <p>Next.js: 🟢 online</p>
            <p style={{ marginTop: 4 }}>Profi на хабе: {hub?.profiOnHub ? "вкл" : "🚫 выкл"}</p>
            <p>Kwork: {collectors?.kwork?.running ? "🟢 активен" : "⏸ остановлен"}</p>
          </div>

          {sources.map((s: any, i: number) => {
            const ad = s.antiDetect || {};
            const isDisabled = !s.enabled;
            return (
              <div key={i} style={{ padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "var(--bg-layer)", opacity: isDisabled ? 0.5 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600 }}>🔌 {s.platform}</span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>({s.login || s.user?.split("@")[0] || "?"})</span>
                  {!isDisabled && s.platform === "profi" && !hub?.profiOnHub && (
                    <span style={{ padding: "2px 8px", borderRadius: 100, fontSize: "var(--text-xs)", fontWeight: 600, background: "var(--accent-soft)", color: "var(--accent)" }}>VPS-агент</span>
                  )}
                  {!isDisabled && <ProtectionBadge mode={ad.mode || "light"} />}
                </div>
                {!isDisabled && (
                  <>
                    <p style={{ color: s.status === "active" ? "var(--green)" : s.status === "error" ? "var(--red)" : "var(--amber)" }}>
                      {s.status === "active" ? "🟢" : s.status === "error" ? "🔴" : "🟡"} {s.status}
                    </p>
                    {s.agentHeartbeat && <p style={{ color: "var(--ink-muted)" }}>💓 Агент: {s.agentHeartbeat}</p>}
                    {s.lastError && <p style={{ color: "var(--red)", fontSize: "0.6rem" }}>{s.lastError.slice(0, 60)}</p>}
                  </>
                )}
              </div>
            );
          })}

          {workspaces.map((ws: any, i: number) => (
            <div key={i} style={{ padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "var(--bg-layer)" }}>
              <p style={{ fontWeight: 600, marginBottom: 4, color: "var(--ink-muted)" }}>📥 {ws.user?.split("@")[0] || "—"}</p>
              <p>
                Сегодня: <b>{ws.today}</b> · Всего: {ws.total}
              </p>
              {ws.lastMinAgo != null && (
                <p style={{ color: ws.lastMinAgo > 120 ? "var(--amber)" : "var(--ink-muted)" }}>Последняя: {ws.lastMinAgo} мин назад</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", fontWeight: 600 }}>🛠 Управление:</span>
        {restartBtn("restart-server", "Next.js", "var(--amber)")}
        {restartBtn("restart-kwork", "Kwork", "var(--accent)")}
        {restartBtn("restart-health", "Health", "var(--green)")}
        {message && <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginLeft: 8 }}>{message}</span>}
      </div>
    </div>
  );
}
