"use client";

import { useCallback, useEffect, useState } from "react";

type Entry = {
  email: string;
  exists: boolean;
  role: string | null;
  firstName: string | null;
  loginEnabled: boolean | null;
};

export default function IdeasBoardAccessPanel() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/ideas-access");
      const d = await r.json();
      if (r.ok) setEntries(d.entries || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function grant() {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/ideas-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setMsg(d.error || "Ошибка");
      return;
    }
    setEntries(d.entries || []);
    setEmail("");
    setMsg(d.added ? "Доступ выдан" : "Уже в списке");
  }

  async function revoke(target: string) {
    if (!confirm(`Отозвать доступ к «Партнеры идеи» у ${target}?`)) return;
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/ideas-access", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: target }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setMsg(d.error || "Ошибка");
      return;
    }
    setEntries(d.entries || []);
    setMsg(d.removed ? "Доступ отозван" : "Не был в списке");
  }

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-surface)",
        padding: 16,
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <strong style={{ fontSize: "var(--text-sm)" }}>Ideas Board · доступ</strong>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 3 }}>
            Раздел «Партнеры идеи» (/dashboard/ideas). Админы видят всегда; партнёрам — выдача email ниже.
          </div>
        </div>
        <a
          href="/dashboard/ideas"
          style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--accent)", alignSelf: "center" }}
        >
          Открыть доску →
        </a>
      </div>

      {loading ? (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>Загрузка…</p>
      ) : (
        <>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", display: "flex", flexDirection: "column", gap: 6 }}>
            {entries.length === 0 && (
              <li style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>Список пуст</li>
            )}
            {entries.map((e) => (
              <li
                key={e.email}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-layer)",
                  fontSize: "var(--text-xs)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis" }}>{e.email}</div>
                  <div style={{ color: "var(--ink-muted)", marginTop: 2 }}>
                    {e.exists
                      ? `${e.firstName || "—"} · ${e.role || "?"} · вход ${e.loginEnabled === false ? "выкл" : "вкл"}`
                      : "пользователя ещё нет в системе"}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => revoke(e.email)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--red)",
                    fontWeight: 600,
                    fontSize: "0.65rem",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  Отозвать
                </button>
              </li>
            ))}
          </ul>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="email партнёра"
              style={{
                flex: 1,
                minWidth: 180,
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--bg-layer)",
                color: "var(--ink-body)",
                fontSize: "var(--text-xs)",
              }}
            />
            <button
              type="button"
              disabled={busy || !email.trim()}
              onClick={grant}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontWeight: 600,
                fontSize: "var(--text-xs)",
                cursor: "pointer",
              }}
            >
              {busy ? "…" : "Выдать доступ"}
            </button>
          </div>
          {msg && (
            <p style={{ margin: "8px 0 0", fontSize: "0.65rem", color: "var(--ink-muted)" }}>{msg}</p>
          )}
        </>
      )}
    </div>
  );
}
