"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface WorkerStatus {
  running: boolean;
  currentSource: string | null;
  lastCheckAt: string | null;
  lastError: string | null;
  uptime: number;
}

export default function StatusIndicator() {
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/worker");
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
          setError(false);
        }
      } catch {
        setError(true);
      }
    }
    fetchStatus();
    const id = setInterval(fetchStatus, 30000);
    return () => clearInterval(id);
  }, []);

  if (error || !status) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 14px", borderRadius: "var(--radius-sm)",
        background: "var(--red-soft)", color: "var(--red)",
        fontSize: "var(--text-xs)", fontWeight: 600,
      }}>
        <XCircle size={14} />
        Нет связи с воркером
      </div>
    );
  }

  if (!status.running) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 14px", borderRadius: "var(--radius-sm)",
        background: "var(--amber-soft)", color: "var(--amber)",
        fontSize: "var(--text-xs)", fontWeight: 600,
      }}>
        <AlertTriangle size={14} />
        Остановлен
      </div>
    );
  }

  if (status.currentSource) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 14px", borderRadius: "var(--radius-sm)",
        background: "var(--blue-soft)", color: "var(--blue)",
        fontSize: "var(--text-xs)", fontWeight: 600,
      }}>
        <Activity size={14} style={{ animation: "pulse 2s infinite" }} />
        Проверка: {status.currentSource}
      </div>
    );
  }

  const secondsAgo = status.lastCheckAt
    ? Math.floor((Date.now() - new Date(status.lastCheckAt).getTime()) / 1000)
    : null;
  const timeAgo = secondsAgo
    ? secondsAgo < 60 ? "только что" : secondsAgo < 3600 ? `${Math.floor(secondsAgo / 60)} мин назад` : `${Math.floor(secondsAgo / 3600)} ч назад`
    : "—";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 14px", borderRadius: "var(--radius-sm)",
      background: "var(--green-soft)", color: "var(--green)",
      fontSize: "var(--text-xs)", fontWeight: 600,
    }}>
      <CheckCircle size={14} />
      Активна · {timeAgo}
    </div>
  );
}
