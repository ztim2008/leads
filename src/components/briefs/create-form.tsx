"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export default function BriefCreateForm() {
  const router = useRouter();
  const [siteUrl, setSiteUrl] = useState("");
  const [regionName, setRegionName] = useState("");
  const [niche, setNiche] = useState("");
  const [goal, setGoal] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/briefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteUrl, regionName, niche, goal }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Не запустилось");
      return;
    }
    router.push(`/dashboard/admin/briefs/${data.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      style={{ display: "grid", gap: 14, maxWidth: 560 }}
    >
      <Field label="Сайт" hint="Адрес, который будем читать">
        <input value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} placeholder="https://" style={inputStyle} />
      </Field>
      <Field label="Регион продвижения">
        <input value={regionName} onChange={(event) => setRegionName(event.target.value)} placeholder="Казань" style={inputStyle} />
      </Field>
      <Field label="Ниша">
        <input value={niche} onChange={(event) => setNiche(event.target.value)} placeholder="Строительство каркасных домов" style={inputStyle} />
      </Field>
      <Field label="Цель рекламы">
        <textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={3} style={inputStyle} />
      </Field>
      {error && <p style={{ margin: 0, color: "var(--red)", fontSize: "var(--text-sm)" }}>{error}</p>}
      <button type="submit" disabled={saving} style={buttonStyle}>
        {saving ? "Ставлю в очередь…" : "Запустить разбор"}
      </button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: "var(--text-sm)", fontWeight: 650, color: "var(--ink-heading)" }}>{label}</span>
      {hint && <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{hint}</span>}
      {children}
    </label>
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
