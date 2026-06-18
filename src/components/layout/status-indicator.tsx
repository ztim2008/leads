"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle, AlertTriangle, XCircle, Clock, Pause } from "lucide-react";

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
}

export default function StatusIndicator() {
  const [status, setStatus] = useState<WorkerStatus | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/worker");
        if (res.ok) setStatus(await res.json());
      } catch {}
    }
    fetchStatus();
    const id = setInterval(fetchStatus, 15000);
    return () => clearInterval(id);
  }, []);

  if (!status) {
    return <Badge icon={<XCircle size={14} />} color="var(--red)" bg="var(--red-soft)" text="Нет связи с воркером" />;
  }

  const reason = status.statusReason || "";
  const isPaused = reason.includes("расписани") || reason.includes("Выходной") || reason.includes("Выключена");
  const isWorking = status.currentSource || reason.includes("Активна") || reason.includes("24/7") || reason.includes("Сбор");
  const isStopped = !status.running;

  if (isStopped) {
    return <Badge icon={<Pause size={14} />} color="var(--amber)" bg="var(--amber-soft)" text="Остановлен" />;
  }

  if (isPaused) {
    return <Badge icon={<Clock size={14} />} color="var(--amber)" bg="var(--amber-soft)" text={reason} />;
  }

  if (isWorking) {
    const timeAgo = status.lastCheckAt
      ? Math.floor((Date.now() - new Date(status.lastCheckAt).getTime()) / 1000)
      : null;
    const agoText = timeAgo
      ? timeAgo < 60 ? "только что" : `${Math.floor(timeAgo / 60)} мин назад`
      : "";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Badge
          icon={<CheckCircle size={14} />}
          color="var(--green)"
          bg="var(--green-soft)"
          text={`${status.currentSource || reason} · ${agoText}`}
        />
        {status.totalCycles != null && (
          <div style={{ fontSize: "0.6rem", color: "var(--ink-muted)", display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <span>Циклов: {status.totalCycles}</span>
            <span>Заявок: {status.totalLeadsCollected || 0}</span>
            {(status.totalErrors || 0) > 0 && <span style={{ color: "var(--red)" }}>Ошибок: {status.totalErrors}</span>}
          </div>
        )}
      </div>
    );
  }

  if (status.lastError) {
    return <Badge icon={<AlertTriangle size={14} />} color="var(--red)" bg="var(--red-soft)" text={status.lastError.slice(0, 60)} />;
  }

  return <Badge icon={<Activity size={14} />} color="var(--blue)" bg="var(--blue-soft)" text={reason || "Ожидание..."} />;
}

function Badge({ icon, color, bg, text }: { icon: React.ReactNode; color: string; bg: string; text: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 14px", borderRadius: "var(--radius-sm)",
      background: bg, color: color,
      fontSize: "var(--text-xs)", fontWeight: 600,
    }}>
      {icon}
      {text}
    </div>
  );
}
