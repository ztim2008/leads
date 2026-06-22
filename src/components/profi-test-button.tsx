"use client";

import { useState } from "react";

interface Props {
  sourceId: string;
  currentLogin: string;
  currentPassword: string;
}

export default function ProfiTestButton({ sourceId, currentLogin, currentPassword }: Props) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleTest(e: React.MouseEvent) {
    e.preventDefault();
    setTesting(true);
    setResult(null);

    // Берём значения из полей формы
    const form = (e.target as HTMLElement).closest("form");
    const loginInput = form?.querySelector('input[name="login"]') as HTMLInputElement;
    const passInput = form?.querySelector('input[name="password"]') as HTMLInputElement;
    const login = loginInput?.value || currentLogin;
    const password = passInput?.value || currentPassword;

    try {
      const res = await fetch("/api/sources/test-profi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, login, password }),
      });
      const d = await res.json();
      setResult({ ok: d.ok, message: d.ok ? d.message : d.error });
    } catch {
      setResult({ ok: false, message: "Ошибка соединения с сервером" });
    }
    setTesting(false);
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={handleTest}
        disabled={testing}
        style={{
          padding: "8px 16px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          background: "var(--bg-layer)",
          color: "var(--ink-body)",
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          cursor: testing ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {testing ? "⏳ Проверяю..." : "🔍 Проверить подключение"}
      </button>

      {result && (
        <div style={{
          marginTop: 8,
          padding: "10px 14px",
          borderRadius: "var(--radius-sm)",
          fontSize: "var(--text-xs)",
          lineHeight: 1.5,
          background: result.ok ? "var(--green-soft)" : "var(--red-soft)",
          color: result.ok ? "var(--green)" : "var(--red)",
          border: `1px solid ${result.ok ? "var(--green)" : "var(--red)"}`,
        }}>
          {result.ok ? "✅ " : "❌ "}
          {result.message}
        </div>
      )}
    </div>
  );
}
