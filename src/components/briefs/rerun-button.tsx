"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

export default function BriefRerun({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function rerun() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/briefs/${projectId}/run`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Не запустилось");
      return;
    }
    router.refresh();
  }

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <button type="button" onClick={() => void rerun()} disabled={busy} style={buttonStyle}>
        {busy ? "Ставлю…" : "Повторить разбор"}
      </button>
      {error && <span style={{ color: "var(--red)", fontSize: "var(--text-sm)" }}>{error}</span>}
    </span>
  );
}

const buttonStyle: CSSProperties = {
  background: "transparent",
  color: "var(--ink-body)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "8px 12px",
  fontWeight: 650,
  cursor: "pointer",
  font: "inherit",
  fontSize: "var(--text-sm)",
  height: 40,
};
