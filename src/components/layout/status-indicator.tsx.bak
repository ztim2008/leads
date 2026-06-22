"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle, AlertTriangle, XCircle, Clock, Pause, Zap } from "lucide-react";

interface WorkerStatus {
  running: boolean;
  currentSource: string | null;
  lastCheckAt: string | null;
  lastError: string | null;
  uptime: number;
  statusReason?: string;
  totalCycles?: number;
  totalErrors?: number;
  totalLeadsCollected?: number;
  checkIntervalMin?: number;
  workspace?: { totalLeads: number; priorityLeads: number; humanLeads: number } | null;
}

export default function StatusIndicator() {
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/worker");
        if (res.ok) setStatus(await res.json());
      } catch {}
    }
    fetchStatus();
    const id = setInterval(fetchStatus, 10000);
    return () => clearInterval(id);
  }, []);

  if (!status) {
    return <Badge icon={<XCircle size={14} />} color="#fff" bg="var(--red)" text="Нет связи с воркером" />;
  }

  const reason = status.statusReason || "";
  const isPaused = reason.includes("расписани") || reason.includes("Выходной") || reason.includes("Выключена");
  const isCollecting = reason.includes("Сбор") || !!status.currentSource;
  const isError = reason.includes("Ошибка") || !!status.lastError;
  const isActive = !isPaused && !isError && status.running;

  // Форматирование времени
  const timeAgo = status.lastCheckAt
    ? Math.floor((Date.now() - new Date(status.lastCheckAt).getTime()) / 1000)
    : null;
  const agoText = timeAgo
    ? timeAgo < 60 ? "только что" : `${Math.floor(timeAgo / 60)} мин назад`
    : "";

  // Статистика внизу
  const intervalText = status.checkIntervalMin
    ? status.checkIntervalMin < 1
      ? `⏱ ${Math.round(status.checkIntervalMin * 60)} сек`
      : `⏱ ${status.checkIntervalMin} мин`
    : null;

  // Статистика workspace (если есть) или глобальная
  const wsLeads = status.workspace?.totalLeads;
  const wsPriority = status.workspace?.priorityLeads;
  const wsHuman = status.workspace?.humanLeads;

  const statsLine = [
    intervalText,
    wsLeads != null ? `Заявок: ${wsLeads}` : (status.totalLeadsCollected != null ? `Заявок: ${status.totalLeadsCollected}` : null),
    wsPriority != null && wsPriority > 0 ? `⭐ ${wsPriority}` : null,
    wsHuman != null && wsHuman > 0 ? `👤 ${wsHuman}` : null,
    (status.totalErrors || 0) > 0 && `Ошибок: ${status.totalErrors}`,
  ].filter(Boolean).join(" · ");

  return (
    <div style={{ position: "relative" }}>
      {/* Основной индикатор */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: "pointer" }}
      >
        {isError && (
          <Badge
            icon={<AlertTriangle size={14} />}
            color="#fff"
            bg="var(--red)"
            text={status.lastError?.slice(0, 50) || "Ошибка"}
          />
        )}
        
        {isPaused && (
          <Badge
            icon={<Clock size={14} />}
            color="var(--amber)"
            bg="var(--amber-soft)"
            text={reason}
          />
        )}

        {isCollecting && (
          <Badge
            icon={<Zap size={14} />}
            color="#fff"
            bg="var(--accent)"
            text={`${status.currentSource || reason} · ${agoText}`}
          />
        )}

        {isActive && !isCollecting && (
          <Badge
            icon={<CheckCircle size={14} />}
            color="var(--green)"
            bg="var(--green-soft)"
            text={`${reason} · ${agoText}`}
          />
        )}

        {!status.running && (
          <Badge
            icon={<Pause size={14} />}
            color="var(--amber)"
            bg="var(--amber-soft)"
            text="Остановлен"
          />
        )}
      </div>

      {/* Строка статистики */}
      {statsLine && (
        <div style={{
          fontSize: "0.6rem", color: "var(--ink-muted)",
          textAlign: "right", marginTop: 3,
        }}>
          {statsLine}
        </div>
      )}

      {/* Разворот с деталями ошибки */}
      {expanded && status.lastError && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: 8,
          width: 360, background: "var(--bg-surface)",
          border: "1px solid var(--red)", borderRadius: "var(--radius-md)",
          padding: 16, zIndex: 200, boxShadow: "var(--shadow-lg)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontWeight: 650, color: "var(--red)", fontSize: "var(--text-sm)" }}>⚠️ Последняя ошибка</span>
            <button onClick={() => setExpanded(false)} style={{ background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-body)", lineHeight: 1.5, wordBreak: "break-all" }}>
            {status.lastError}
          </p>
          <p style={{ fontSize: "0.6rem", color: "var(--ink-muted)", marginTop: 8 }}>
            Всего ошибок: {status.totalErrors || 0} · Циклов: {status.totalCycles || 0}
          </p>
        </div>
      )}
    </div>
  );
}

function Badge({ icon, color, bg, text }: { icon: React.ReactNode; color: string; bg: string; text: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "7px 14px", borderRadius: "var(--radius-sm)",
      background: bg, color: color,
      fontSize: "var(--text-xs)", fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {icon}
      {text}
    </div>
  );
}
