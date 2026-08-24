"use client";

import { useState } from "react";
import type { ReplyTemplate } from "@/lib/leads/reply-templates";
import { MAX_REPLY_TEMPLATES } from "@/lib/leads/reply-templates";

const inp: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  background: "var(--bg-root)",
  color: "var(--ink-body)",
  fontSize: "var(--text-sm)",
  boxSizing: "border-box",
};

const lbl: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-xs)",
  color: "var(--ink-muted)",
  marginBottom: 6,
  fontWeight: 500,
};

const VARS = [
  { v: "{имя}", l: "Имя" },
  { v: "{задача}", l: "Задача" },
  { v: "{город}", l: "Город" },
  { v: "{бюджет}", l: "Бюджет" },
  { v: "{отзывы}", l: "Отзывы" },
  { v: "{цена_отклика}", l: "Цена отклика" },
  { v: "{ссылка}", l: "Ссылка" },
];

function blankTemplate(i: number): ReplyTemplate {
  return {
    id: `new_${i}_${Date.now().toString(36)}`,
    name: i === 0 ? "Основной" : `Шаблон ${i + 1}`,
    body: "",
  };
}

export default function ReplyTemplatesForm({
  workspaceId,
  initial,
}: {
  workspaceId: string;
  initial: ReplyTemplate[];
}) {
  const [items, setItems] = useState<ReplyTemplate[]>(
    initial.length ? initial : [],
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [insertTarget, setInsertTarget] = useState(0);

  function update(i: number, patch: Partial<ReplyTemplate>) {
    setItems((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  function add() {
    if (items.length >= MAX_REPLY_TEMPLATES) return;
    setItems((prev) => [...prev, blankTemplate(prev.length)]);
  }

  function remove(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function insertVar(token: string) {
    const i = Math.min(insertTarget, Math.max(0, items.length - 1));
    if (i < 0 || !items[i]) return;
    const cur = items[i].body || "";
    update(i, { body: cur + (cur && !cur.endsWith(" ") && !cur.endsWith("\n") ? " " : "") + token });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          replyTemplates: items
            .map((t) => ({ id: t.id, name: t.name, body: t.body }))
            .filter((t) => t.body.trim()),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setToast(data.error || "Не удалось сохранить");
        return;
      }
      if (Array.isArray(data.replyTemplates)) setItems(data.replyTemplates);
      setToast("Сохранено. Новые заявки в Telegram получат текст отклика для копирования.");
    } catch {
      setToast("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSave} style={{ maxWidth: 640, marginTop: 36 }}>
      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: 6 }}>Шаблоны отклика</h2>
      <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginBottom: 16 }}>
        До {MAX_REPLY_TEMPLATES} текстов. В Telegram придёт блок «Текст отклика» и кнопка копирования
        (если текст не длиннее 256 символов). Отправку на Profi делаете сами — авто-отправки нет.
        На Profi можно держать свои шаблоны отдельно (до 15).
      </p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {VARS.map((v) => (
          <button
            key={v.v}
            type="button"
            onClick={() => insertVar(v.v)}
            style={{
              cursor: "pointer",
              padding: "5px 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-layer)",
              color: "var(--ink-body)",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
            title={`Вставить ${v.v} в шаблон №${insertTarget + 1}`}
          >
            {v.l}
          </button>
        ))}
      </div>

      {items.length === 0 && (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginBottom: 12 }}>
          Шаблонов пока нет — заявки в Telegram без блока текста. Добавьте хотя бы один.
        </p>
      )}

      {items.map((t, i) => (
        <div
          key={t.id}
          onFocusCapture={() => setInsertTarget(i)}
          style={{
            marginBottom: 16,
            padding: 14,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            background: "var(--bg-layer)",
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Название</label>
              <input
                value={t.name}
                onChange={(e) => update(i, { name: e.target.value })}
                maxLength={40}
                placeholder={`Шаблон ${i + 1}`}
                style={inp}
              />
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              style={{
                padding: "10px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--ink-muted)",
                cursor: "pointer",
                fontSize: "var(--text-sm)",
              }}
            >
              Удалить
            </button>
          </div>
          <label style={lbl}>Текст</label>
          <textarea
            value={t.body}
            onChange={(e) => update(i, { body: e.target.value })}
            rows={5}
            maxLength={900}
            placeholder="Здравствуйте, {имя}! Готов взяться за «{задача}». Могу созвониться и уточнить детали."
            style={{ ...inp, fontFamily: "var(--font-mono)", resize: "vertical", minHeight: 110 }}
          />
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 6 }}>
            {t.body.length}/900
            {t.body.length > 256
              ? " · длиннее 256 — в TG текст будет в сообщении, кнопка «Скопировать» только до 256"
              : t.body.length > 0
                ? " · будет кнопка копирования в Telegram"
                : ""}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {items.length < MAX_REPLY_TEMPLATES && (
          <button
            type="button"
            onClick={add}
            style={{
              padding: "10px 16px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg-root)",
              color: "var(--ink-body)",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "var(--text-sm)",
            }}
          >
            + Шаблон
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "10px 18px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontWeight: 600,
            cursor: saving ? "wait" : "pointer",
            fontSize: "var(--text-sm)",
          }}
        >
          {saving ? "Сохраняем…" : "Сохранить шаблоны"}
        </button>
      </div>
      {toast && (
        <p style={{ marginTop: 12, fontSize: "var(--text-sm)", color: "var(--ink-body)" }}>{toast}</p>
      )}
    </form>
  );
}
