"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { KIND_LABELS, type FindingKind } from "@/lib/briefs/sections";

export type FindingView = {
  id: string;
  kind: string;
  title: string;
  body: string;
  evidenceUrl: string | null;
  evidenceQuote: string | null;
};

export default function FindingEditor({ finding }: { finding: FindingView }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(finding.title);
  const [body, setBody] = useState(finding.body);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const kind = (finding.kind in KIND_LABELS ? finding.kind : "fact") as FindingKind;

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/briefs/findings/${finding.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Не сохранилось");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <article className="brief-item">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 650 }}>{editing ? KIND_LABELS[kind] : title}</h3>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} style={quietButton}>
            Править
          </button>
        )}
      </div>
      {editing ? (
        <div style={{ display: "grid", gap: 8 }}>
          <input value={title} onChange={(event) => setTitle(event.target.value)} style={{ ...inputStyle, height: 40 }} />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} style={inputStyle} />
          {error && <p style={{ margin: 0, color: "var(--red)", fontSize: "var(--text-sm)" }}>{error}</p>}
          <span style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => void save()} disabled={saving} style={quietButton}>
              {saving ? "Сохраняю…" : "Сохранить"}
            </button>
            <button type="button" onClick={() => setEditing(false)} style={quietButton}>
              Отмена
            </button>
          </span>
        </div>
      ) : (
        <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{body}</p>
      )}
      {finding.evidenceUrl && (
        <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-muted)", lineHeight: 1.45 }}>
          <a href={finding.evidenceUrl} target="_blank" rel="noreferrer">
            {finding.evidenceUrl}
          </a>
          {finding.evidenceQuote ? ` · «${finding.evidenceQuote}»` : ""}
        </p>
      )}
    </article>
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

const quietButton: CSSProperties = {
  background: "transparent",
  color: "var(--ink-body)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "0 12px",
  fontWeight: 650,
  cursor: "pointer",
  font: "inherit",
  fontSize: "var(--text-sm)",
  height: 40,
};
