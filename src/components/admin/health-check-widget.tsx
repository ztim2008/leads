"use client";

import { useState, useEffect } from "react";
import { Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw } from "lucide-react";

export default function HealthCheckWidget() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function check() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/health-check");
      if (res.ok) setHealth(await res.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => { check(); }, []);

  const overallColor = health?.overall === "ok" ? "var(--green)" : health?.overall === "warning" ? "var(--amber)" : "var(--red)";
  const overallBg = health?.overall === "ok" ? "var(--green-soft)" : health?.overall === "warning" ? "var(--amber-soft)" : "var(--red-soft)";

  return (
    <div style={{ border: `1px solid ${overallColor}20`, borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-surface)", marginBottom: 24 }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Activity size={18} style={{ color: overallColor }} />
          <span style={{ fontWeight: 650, fontSize: "var(--text-sm)" }}>
            {loading ? "⏳ Проверка..." : health?.overall === "ok" ? "🟢 Система работает" : health?.overall === "warning" ? "🟡 Требуется внимание" : health?.overall === "error" ? "🔴 Обнаружены проблемы" : "Загрузка..."}
          </span>
        </div>
        <button onClick={check} disabled={loading} style={{ background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "4px 10px", cursor: "pointer", color: "var(--ink-muted)", display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-xs)" }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Проверить
        </button>
      </div>

      {health && (
        <div style={{ padding: "14px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: "var(--text-xs)" }}>
          {/* Worker */}
          <div>
            <p style={{ fontWeight: 600, marginBottom: 4, color: "var(--ink-muted)" }}>⚙️ Воркер</p>
            <p style={{ color: health.worker?.status === "ok" ? "var(--green)" : "var(--red)" }}>
              {health.worker?.running ? "🟢 Активен" : "🔴 Остановлен"}
              {health.worker?.lastCheckSec != null && ` · ${Math.floor(health.worker.lastCheckSec / 60)} мин назад`}
            </p>
            {health.worker?.errors > 0 && <p style={{ color: "var(--red)" }}>Ошибок: {health.worker.errors}</p>}
          </div>

          {/* Sources */}
          {health.sources?.map((s: any, i: number) => (
            <div key={i}>
              <p style={{ fontWeight: 600, marginBottom: 4, color: "var(--ink-muted)" }}>🔌 {s.platform} ({s.user?.split("@")[0]})</p>
              <p style={{ color: s.status === "active" ? "var(--green)" : s.status === "error" ? "var(--red)" : "var(--amber)" }}>
                {s.status === "active" ? "🟢" : s.status === "error" ? "🔴" : "🟡"} {s.status}
                {s.lastError ? ` — ${s.lastError.slice(0, 50)}` : ""}
              </p>
            </div>
          ))}

          {/* Today's leads */}
          {health.workspaces?.map((ws: any, i: number) => (
            <div key={i}>
              <p style={{ fontWeight: 600, marginBottom: 4, color: "var(--ink-muted)" }}>📥 {ws.user?.split("@")[0]}</p>
              <p>Сегодня: <b>{ws.today}</b> заявок · Всего: {ws.total}</p>
              {ws.lastMinAgo != null && <p style={{ color: ws.lastMinAgo > 120 ? "var(--amber)" : "var(--ink-muted)" }}>Последняя: {ws.lastMinAgo} мин назад</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
