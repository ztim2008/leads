"use client";

import { useState, type CSSProperties } from "react";

type Entry = { email: string; firstName: string | null; role: string | null };

export default function BriefAccessForm({ initial }: { initial: Entry[] }) {
  const [entries, setEntries] = useState(initial);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/briefs/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Не добавилось");
      return;
    }
    setEntries(data.entries || []);
    setEmail("");
  }

  async function remove(target: string) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/briefs/access", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: target }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Не убралось");
      return;
    }
    setEntries(data.entries || []);
  }

  return (
    <section style={{ display: "grid", gap: 12, maxWidth: 560 }}>
      <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 650 }}>Директолог</h2>
      <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: "var(--text-sm)", lineHeight: 1.45 }}>
        Доступ к этому разделу. Остальная админка ему закрыта. Учётка уже должна существовать.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="email"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button type="submit" disabled={busy} style={buttonStyle}>
          Подключить
        </button>
      </form>
      {error && <p style={{ margin: 0, color: "var(--red)", fontSize: "var(--text-sm)" }}>{error}</p>}
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
        {entries.map((entry) => (
          <li key={entry.email} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: "var(--text-sm)" }}>
              {entry.email}
              {entry.firstName ? ` · ${entry.firstName}` : ""}
            </span>
            <button type="button" disabled={busy} onClick={() => void remove(entry.email)} style={quietButton}>
              Убрать
            </button>
          </li>
        ))}
        {entries.length === 0 && <li style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Пока никого</li>}
      </ul>
    </section>
  );
}

const inputStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--bg-surface)",
  color: "var(--ink-body)",
  padding: "10px 12px",
  font: "inherit",
  fontSize: "var(--text-sm)",
};

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
  background: "transparent",
  color: "var(--ink-muted)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "6px 10px",
  cursor: "pointer",
  font: "inherit",
  fontSize: "var(--text-sm)",
};
