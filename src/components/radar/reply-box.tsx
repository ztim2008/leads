"use client";

import { useState, type CSSProperties } from "react";

export default function ReplyBox({ id, initial }: { id: string; initial: string | null }) {
  const [text, setText] = useState(initial || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function prepare() {
    setLoading(true);
    setError("");
    setCopied(false);
    const res = await fetch(`/api/radar/vacancies/${id}/reply`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) setError(data.error || "Не удалось подготовить отклик");
    else setText(data.text || "");
  }

  async function copy() {
    if (!text.trim()) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <section style={{ display: "grid", gap: 10 }}>
      <h2 style={{ fontSize: "var(--text-lg)", margin: 0 }}>Отклик</h2>
      <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
        Письмо остаётся у вас. На сайт вакансии его нужно вставить и отправить самому.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => void prepare()} disabled={loading} style={buttonStyle}>
          {loading ? "Готовлю…" : "Подготовить отклик"}
        </button>
        <button type="button" onClick={() => void copy()} disabled={!text.trim()} style={quietButton}>
          {copied ? "Скопировано" : "Скопировать"}
        </button>
      </div>
      {error && <p style={{ color: "var(--red)", margin: 0, fontSize: "var(--text-sm)" }}>{error}</p>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        placeholder="Черновик появится здесь"
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          background: "var(--bg-surface)",
          color: "var(--ink-body)",
          padding: 12,
          font: "inherit",
          fontSize: "var(--text-sm)",
          lineHeight: 1.5,
        }}
      />
    </section>
  );
}

const buttonStyle: CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: 0,
  borderRadius: "var(--radius-sm)",
  padding: "10px 16px",
  fontWeight: 650,
  cursor: "pointer",
};

const quietButton: CSSProperties = {
  background: "var(--bg-surface)",
  color: "var(--ink-body)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "10px 16px",
  fontWeight: 650,
  cursor: "pointer",
};
