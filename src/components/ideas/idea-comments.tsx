"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Comment = {
  id: string;
  body: string;
  authorName: string;
  authorEmail: string | null;
  createdAt: string;
};

export default function IdeaComments({
  ideaId,
  initialComments,
}: {
  ideaId: string;
  initialComments: Comment[];
}) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/ideas/${ideaId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setError(d.error || "Ошибка");
      return;
    }
    setComments((prev) => [
      ...prev,
      {
        id: d.comment.id,
        body: d.comment.body,
        authorName: d.comment.authorName,
        authorEmail: d.comment.authorEmail,
        createdAt: d.comment.createdAt,
      },
    ]);
    setBody("");
    router.refresh();
  }

  return (
    <div>
      <h2
        style={{
          fontSize: "var(--text-base)",
          fontWeight: 700,
          color: "var(--ink-heading)",
          marginBottom: 12,
        }}
      >
        Комментарии ({comments.length})
      </h2>

      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {comments.length === 0 && (
          <li style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
            Пока нет комментариев — напишите первым.
          </li>
        )}
        {comments.map((c) => (
          <li
            key={c.id}
            style={{
              padding: "12px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg-layer)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 6,
                flexWrap: "wrap",
              }}
            >
              <strong style={{ fontSize: "var(--text-xs)", color: "var(--ink-heading)" }}>
                {c.authorName}
              </strong>
              <time style={{ fontSize: "0.65rem", color: "var(--ink-muted)" }}>
                {new Date(c.createdAt).toLocaleString("ru-RU", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "var(--text-sm)",
                color: "var(--ink-body)",
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
              }}
            >
              {c.body}
            </p>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ваш комментарий…"
          rows={3}
          maxLength={8000}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            background: "var(--bg-layer)",
            color: "var(--ink-body)",
            fontSize: "var(--text-sm)",
            resize: "vertical",
            fontFamily: "inherit",
            boxSizing: "border-box",
            lineHeight: 1.45,
          }}
        />
        {error && (
          <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--red)" }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={busy || !body.trim()}
          style={{
            alignSelf: "flex-start",
            padding: "8px 14px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontWeight: 650,
            fontSize: "var(--text-xs)",
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "Отправка…" : "Отправить"}
        </button>
      </form>
    </div>
  );
}
