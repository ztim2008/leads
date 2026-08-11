"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { onCreated?: () => void };

export default function AddPartnerButton({ onCreated }: Props) {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [setupCommand, setSetupCommand] = useState("");
  const [partnerPassword, setPartnerPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setSetupCommand("");
    const fd = new FormData(e.currentTarget);
    const body: Record<string, string | number> = {};
    fd.forEach((v, k) => {
      body[k] = v as string;
    });
    body.budgetMin = parseInt(String(body.budgetMin)) || 3000;
    body.budgetMax = parseInt(String(body.budgetMax)) || 500000;
    const pwd = String(body.password || "");
    const res = await fetch("/api/admin/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (d.ok) {
      setMsg("✅ Партнёр создан! Сохраните пароль для партнёра.");
      setPartnerPassword(pwd);
      if (d.setupCommand) setSetupCommand(d.setupCommand);
      onCreated?.();
      router.refresh();
    } else {
      setMsg("❌ " + (d.error || "Ошибка"));
    }
    setLoading(false);
  }

  async function copyCommand() {
    await navigator.clipboard.writeText(setupCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const i: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "var(--bg-root)",
    color: "var(--ink-body)",
    fontSize: "var(--text-xs)",
    outline: "none",
    boxSizing: "border-box",
  };
  const t: React.CSSProperties = { ...i, minHeight: 60, resize: "vertical" };
  const lbl: React.CSSProperties = { fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 4, display: "block" };
  const block: React.CSSProperties = {
    padding: "14px 16px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    marginBottom: 12,
    background: "var(--bg-layer)",
  };
  const blockTitle: React.CSSProperties = { fontWeight: 650, fontSize: "var(--text-xs)", color: "var(--ink-heading)", marginBottom: 10 };

  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        style={{
          padding: "10px 18px",
          borderRadius: "var(--radius-sm)",
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          fontWeight: 600,
          fontSize: "var(--text-sm)",
          cursor: "pointer",
        }}
      >
        + Создать партнёра
      </button>
    );
  }

  return (
    <div style={{ padding: "4px 0" }}>
      <form onSubmit={handleSubmit}>
        <div style={block}>
          <div style={blockTitle}>👤 Аккаунт партнёра (вход в дашборд)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Email *</label>
              <input name="email" type="email" required style={i} placeholder="partner@email.ru" />
            </div>
            <div>
              <label style={lbl}>Имя</label>
              <input name="name" style={i} placeholder="Иван" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={lbl}>Пароль для входа партнёра *</label>
              <input name="password" type="text" required style={i} placeholder="Минимум 6 символов — сохраните и передадите партнёру" />
            </div>
          </div>
        </div>

        <div style={block}>
          <div style={blockTitle}>🔌 Profi.ru (сбор только на VPS)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Логин Profi *</label>
              <input name="profiLogin" required style={i} placeholder="логин специалиста" />
            </div>
            <div>
              <label style={lbl}>Пароль Profi *</label>
              <input name="profiPassword" type="password" required style={i} />
            </div>
          </div>
        </div>

        <div style={block}>
          <div style={blockTitle}>🎯 Фильтры</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Ключевые слова</label>
              <textarea name="keywords" style={t} placeholder="сайт, лендинг, дизайн" />
            </div>
            <div>
              <label style={lbl}>Минус-слова</label>
              <textarea name="minusKeywords" style={t} placeholder="игры, 1с" />
            </div>
            <div>
              <label style={lbl}>Бюджет от (₽)</label>
              <input name="budgetMin" type="number" defaultValue={3000} style={i} />
            </div>
            <div>
              <label style={lbl}>Бюджет до (₽)</label>
              <input name="budgetMax" type="number" defaultValue={500000} style={i} />
            </div>
          </div>
        </div>

        <div style={block}>
          <div style={blockTitle}>📱 Telegram уведомления</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Chat ID</label>
              <input name="telegramChatId" style={i} placeholder="из @getmyid_bot" />
            </div>
            <div>
              <label style={lbl}>Bot Token</label>
              <input name="telegramToken" style={i} placeholder="из @BotFather" />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 20px",
              borderRadius: "var(--radius-sm)",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              fontWeight: 600,
              fontSize: "var(--text-sm)",
              cursor: "pointer",
            }}
          >
            {loading ? "Создаю…" : "✅ Создать партнёра"}
          </button>
          <button
            type="button"
            onClick={() => setShow(false)}
            style={{
              padding: "10px 20px",
              background: "transparent",
              color: "var(--ink-muted)",
              border: "1px solid var(--border)",
              fontSize: "var(--text-sm)",
              cursor: "pointer",
            }}
          >
            Отмена
          </button>
          {msg && (
            <span style={{ fontSize: "var(--text-xs)", color: msg.includes("✅") ? "var(--green)" : "var(--red)" }}>
              {msg}
            </span>
          )}
        </div>

        {partnerPassword && msg.includes("✅") && (
          <div style={{ ...block, marginTop: 16, border: "1px solid var(--amber)", background: "#f59e0b10" }}>
            <div style={blockTitle}>🔑 Пароль для партнёра (скопируйте сейчас)</div>
            <code style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>{partnerPassword}</code>
          </div>
        )}

        {setupCommand && (
          <div style={{ ...block, background: "var(--accent-soft)", border: "1px solid var(--accent)", marginTop: 16 }}>
            <div style={blockTitle}>🚀 Следующий шаг: установка на VPS</div>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 8 }}>
              После создания — купите VPS, введите IP в карточку ниже и выполните команду на сервере.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <code
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-root)",
                  border: "1px solid var(--border)",
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                  wordBreak: "break-all",
                }}
              >
                {setupCommand}
              </code>
              <button
                type="button"
                onClick={copyCommand}
                style={{
                  padding: "8px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: copied ? "var(--green)" : "var(--accent)",
                  color: "#fff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "var(--text-xs)",
                  cursor: "pointer",
                }}
              >
                {copied ? "✅ Скопировано" : "📋 Копировать"}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
