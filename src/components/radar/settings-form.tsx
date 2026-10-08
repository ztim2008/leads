"use client";

import { useState, type CSSProperties } from "react";

type Settings = {
  enabled: boolean;
  alertsEnabled: boolean;
  requireSalary: boolean;
  remoteOnly: boolean;
  salaryMin: number;
  matchMin: number;
  trustMin: number;
  dailyAlertCap: number;
  quietStart: string;
  quietEnd: string;
  telegramChatId: string | null;
};

export default function SettingsForm({
  settings,
  aiReady,
  lastCheckAt,
  lastError,
  lastNewCount,
}: {
  settings: Settings;
  aiReady: boolean;
  lastCheckAt: string | null;
  lastError: string | null;
  lastNewCount: number;
}) {
  const [form, setForm] = useState({
    ...settings,
    telegramChatId: settings.telegramChatId || "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runNote, setRunNote] = useState("");

  function patch<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    const res = await fetch("/api/radar/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        telegramChatId: form.telegramChatId.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) setError(data.error || "Не сохранилось");
    else setMessage("Настройки сохранены");
  }

  async function runNow() {
    setRunning(true);
    setRunNote("");
    const res = await fetch("/api/radar/run", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setRunning(false);
    if (!res.ok) setRunNote(data.error || "Обход не выполнился");
    else setRunNote(`Просмотрено ${data.scanned ?? 0}, новых ${data.saved ?? 0}, в Telegram ${data.notified ?? 0}${data.error ? `. ${data.error}` : ""}`);
  }

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 640 }}>
      <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
        {aiReady
          ? "Модель подключена: совпадение от 70 уточняется, отклик готовится по кнопке."
          : "Ключ OpenRouter не задан: совпадение считается по профилю, черновик отклика недоступен."}
      </p>
      <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-body)" }}>
        Последний обход: {lastCheckAt ? new Date(lastCheckAt).toLocaleString("ru-RU") : "ещё не было"}
        {" · "}новых {lastNewCount}
        {lastError ? ` · ${lastError}` : ""}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        style={{ display: "grid", gap: 14 }}
      >
        <Check label="Сбор включён" checked={form.enabled} onChange={(v) => patch("enabled", v)} />
        <Check label="Пуши в Telegram" checked={form.alertsEnabled} onChange={(v) => patch("alertsEnabled", v)} />
        <Check label="Только удалёнка" checked={form.remoteOnly} onChange={(v) => patch("remoteOnly", v)} />
        <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
          Удалёнка по всей России: город не выбирается. В ленту попадает только сегодня. На HH ещё и не больше 3 откликов, у «Работы в России» и Работа.ру числа откликов нет. Зарплата на карточке есть и отбор не режет. Вчерашнее удаляется само.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Num label="Пушей в день" value={form.dailyAlertCap} onChange={(v) => patch("dailyAlertCap", v)} />
          <label style={{ display: "grid", gap: 6, fontSize: "var(--text-sm)" }}>
            <span style={{ fontWeight: 650, color: "var(--ink-heading)" }}>Тихие часы, МСК</span>
            <span style={{ display: "flex", gap: 8 }}>
              <input value={form.quietStart} onChange={(e) => patch("quietStart", e.target.value)} style={inputStyle} />
              <input value={form.quietEnd} onChange={(e) => patch("quietEnd", e.target.value)} style={inputStyle} />
            </span>
          </label>
        </div>
        <label style={{ display: "grid", gap: 6, fontSize: "var(--text-sm)" }}>
          <span style={{ fontWeight: 650, color: "var(--ink-heading)" }}>Chat ID Telegram</span>
          <span style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}>Пусто — чат админа из настроек сервера</span>
          <input value={form.telegramChatId} onChange={(e) => patch("telegramChatId", e.target.value)} style={inputStyle} />
        </label>
        {error && <p style={{ color: "var(--red)", margin: 0, fontSize: "var(--text-sm)" }}>{error}</p>}
        {message && <p style={{ color: "var(--green)", margin: 0, fontSize: "var(--text-sm)" }}>{message}</p>}
        <button type="submit" disabled={saving} style={buttonStyle}>
          {saving ? "Сохраняю…" : "Сохранить настройки"}
        </button>
      </form>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <button type="button" onClick={() => void runNow()} disabled={running} style={buttonStyle}>
          {running ? "Смотрю вакансии…" : "Собрать сейчас"}
        </button>
        {runNote && <p style={{ fontSize: "var(--text-sm)", margin: "10px 0 0" }}>{runNote}</p>}
      </div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: "var(--text-sm)" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: "var(--text-sm)" }}>
      <span style={{ fontWeight: 650, color: "var(--ink-heading)" }}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={inputStyle}
      />
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
