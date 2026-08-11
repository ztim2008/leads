"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PendingAction } from "@/lib/assistant/types";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  pendingAction?: PendingAction;
}

const QUICK = [
  "список партнёров",
  "помощь",
  "статус ",
  "продли ",
  "команда vps ",
];

export default function OperatorAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Помощник оператора. Команды без SSH — только через API. Напишите «помощь» или выберите быструю команду.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [llmConfigured, setLlmConfigured] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/admin/assistant")
      .then((r) => r.json())
      .then((d) => setLlmConfigured(d.llmConfigured))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async (text: string, confirm?: PendingAction) => {
    if (!text.trim() && !confirm) return;
    setLoading(true);

    if (text.trim()) {
      setMessages((m) => [...m, { role: "user", text: text.trim() }]);
      setInput("");
    }

    try {
      const body = confirm
        ? { confirm: { type: confirm.type, params: confirm.params } }
        : { message: text.trim() };

      const res = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: data.reply || data.error || "Ошибка",
          pendingAction: data.pendingAction,
        },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Ошибка соединения" }]);
    }
    setLoading(false);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 220px)",
        minHeight: 420,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-surface)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <span style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>Помощник оператора</span>
          <span style={{ fontSize: "0.65rem", color: "var(--ink-muted)", marginLeft: 8 }}>
            {llmConfigured ? "ИИ: подключён" : "ИИ: правила (добавьте OPENAI_API_KEY)"}
          </span>
        </div>
        <span style={{ fontSize: "0.65rem", color: "var(--amber)" }}>Пароли SSH не сохраняются</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              alignItems: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                background: msg.role === "user" ? "var(--accent)" : "var(--bg-layer)",
                color: msg.role === "user" ? "#fff" : "var(--ink-body)",
                fontSize: "var(--text-sm)",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {msg.text}
            </div>
            {msg.pendingAction && i === messages.length - 1 && !loading && (
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => send("", msg.pendingAction!)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--green)",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    fontSize: "var(--text-xs)",
                    cursor: "pointer",
                  }}
                >
                  ✓ Подтвердить
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMessages((m) => [
                      ...m,
                      { role: "assistant", text: "Действие отменено." },
                    ])
                  }
                  style={{
                    padding: "8px 16px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    fontSize: "var(--text-xs)",
                    cursor: "pointer",
                  }}
                >
                  Отмена
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>Думаю…</p>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setInput((prev) => (prev ? prev : q))}
              style={{
                padding: "4px 10px",
                borderRadius: 100,
                border: "1px solid var(--border)",
                background: "var(--bg-layer)",
                fontSize: "0.65rem",
                cursor: "pointer",
                color: "var(--ink-muted)",
              }}
            >
              {q.trim()}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          style={{ display: "flex", gap: 8 }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Команда или вставьте IP + email партнёра…"
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg-root)",
              fontSize: "var(--text-sm)",
            }}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              padding: "10px 20px",
              borderRadius: "var(--radius-sm)",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            →
          </button>
        </form>
      </div>
    </div>
  );
}
