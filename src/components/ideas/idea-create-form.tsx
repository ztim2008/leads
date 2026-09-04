"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function IdeaCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, tags }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setError(d.error || "Ошибка сохранения");
      return;
    }
    router.push(`/dashboard/ideas/${d.idea.id}`);
    router.refresh();
  }

  const field: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "var(--bg-layer)",
    color: "var(--ink-body)",
    fontSize: "var(--text-sm)",
    boxSizing: "border-box",
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 650, color: "var(--ink-muted)" }}>Заголовок</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Кратко: о чём идея"
          style={field}
          maxLength={200}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 650, color: "var(--ink-muted)" }}>Описание</span>
        <textarea
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Контекст, цель, ограничения…"
          rows={10}
          style={{ ...field, resize: "vertical", lineHeight: 1.5, fontFamily: "inherit" }}
          maxLength={20000}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 650, color: "var(--ink-muted)" }}>
          Теги (через запятую, необязательно)
        </span>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="product, agent, billing"
          style={field}
        />
      </label>

      <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-muted)", lineHeight: 1.45 }}>
        После создания агент разложит идею на за/против, сильные/слабые стороны, риски и следующие шаги.
      </p>

      {error && (
        <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--red)" }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="submit"
          disabled={busy || !title.trim() || !body.trim()}
          style={{
            padding: "10px 18px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontWeight: 650,
            fontSize: "var(--text-sm)",
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "Создаю и анализирую…" : "Создать идею"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard/ideas")}
          style={{
            padding: "10px 18px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--ink-body)",
            fontWeight: 550,
            fontSize: "var(--text-sm)",
            cursor: "pointer",
          }}
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
