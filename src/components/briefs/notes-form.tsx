"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

export default function BriefNotes({ projectId, initial }: { projectId: string; initial: string }) {
  const router = useRouter();
  const [body, setBody] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/briefs/${projectId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Не сохранилось");
      return;
    }
    router.refresh();
  }

  return (
    <section style={{ display: "grid", gap: 8 }}>
      <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 650 }}>Заметки к отчёту</h2>
      <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>
        Цены работ и прогноз заявок сюда вписываете вы. Модель их не считает.
      </p>
      <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={6} style={inputStyle} />
      {error && <p style={{ margin: 0, color: "var(--red)", fontSize: "var(--text-sm)" }}>{error}</p>}
      <button type="button" onClick={() => void save()} disabled={saving} style={buttonStyle}>
        {saving ? "Сохраняю…" : "Сохранить заметки"}
      </button>
    </section>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--bg-surface)",
  color: "var(--ink-body)",
  padding: "10px 12px",
  font: "inherit",
  fontSize: "var(--text-sm)",
};

const buttonStyle: CSSProperties = {
  justifySelf: "start",
  background: "var(--accent)",
  color: "#fff",
  border: 0,
  borderRadius: "var(--radius-sm)",
  padding: "10px 16px",
  fontWeight: 650,
  cursor: "pointer",
};
