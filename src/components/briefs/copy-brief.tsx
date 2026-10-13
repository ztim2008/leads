"use client";

import { useState, type CSSProperties } from "react";

export default function CopyBrief({ text }: { text: string }) {
  const [label, setLabel] = useState("Скопировать в Telegram");
  const [error, setError] = useState("");

  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(text);
      setLabel("Скопировано");
      window.setTimeout(() => setLabel("Скопировать в Telegram"), 2000);
    } catch {
      setError("Не удалось скопировать");
    }
  }

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <button type="button" onClick={() => void copy()} style={buttonStyle}>
        {label}
      </button>
      {error && <span style={{ color: "var(--red)", fontSize: "var(--text-sm)" }}>{error}</span>}
    </span>
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
  font: "inherit",
  fontSize: "var(--text-sm)",
  height: 40,
};
