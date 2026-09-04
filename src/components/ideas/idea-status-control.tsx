"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IDEA_STATUSES,
  IDEA_STATUS_LABELS,
  type IdeaStatus,
} from "@/lib/ideas/constants";

export default function IdeaStatusControl({
  ideaId,
  initialStatus,
  canEdit,
}: {
  ideaId: string;
  initialStatus: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onChange(next: string) {
    if (!canEdit || next === status) return;
    setBusy(true);
    setMsg(null);
    const r = await fetch(`/api/ideas/${ideaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setMsg(d.error || "Не удалось обновить");
      return;
    }
    setStatus(next);
    setMsg("Сохранено");
    router.refresh();
  }

  if (!canEdit) {
    const label = IDEA_STATUS_LABELS[status as IdeaStatus] || status;
    return (
      <span
        style={{
          display: "inline-block",
          padding: "4px 10px",
          borderRadius: "var(--radius-sm)",
          background: "var(--bg-layer)",
          border: "1px solid var(--border)",
          fontSize: "var(--text-xs)",
          fontWeight: 650,
          color: "var(--ink-body)",
        }}
      >
        {label}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <select
        value={status}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "8px 10px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          background: "var(--bg-layer)",
          color: "var(--ink-body)",
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          cursor: "pointer",
          minWidth: 160,
        }}
      >
        {IDEA_STATUSES.map((s) => (
          <option key={s} value={s}>
            {IDEA_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {msg && (
        <span style={{ fontSize: "0.65rem", color: "var(--ink-muted)" }}>{msg}</span>
      )}
    </div>
  );
}
