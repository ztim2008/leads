"use client";

import { useState } from "react";
import type { PartnerAccessCard } from "@/lib/admin/access-card";

type Props = {
  card: PartnerAccessCard;
  onClose?: () => void;
  title?: string;
};

function Row({
  label,
  value,
  secret,
}: {
  label: string;
  value: string | null | undefined;
  secret?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const empty = !value;
  const display = empty ? "—" : secret && !show ? "••••••••" : value;

  async function copy() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{label}</span>
      <code style={{ fontSize: "0.8rem", wordBreak: "break-all", fontFamily: "monospace" }}>{display}</code>
      <div style={{ display: "flex", gap: 4 }}>
        {secret && value && (
          <button type="button" onClick={() => setShow((s) => !s)} style={miniBtn}>
            {show ? "скрыть" : "показать"}
          </button>
        )}
        {value && (
          <button type="button" onClick={copy} style={miniBtn}>
            {copied ? "ок" : "копир."}
          </button>
        )}
      </div>
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  padding: "3px 8px",
  fontSize: "0.65rem",
  fontWeight: 600,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--bg-root)",
  color: "var(--ink-body)",
  cursor: "pointer",
};

export default function PartnerAccessCardModal({ card, onClose, title }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, margin: 0 }}>
              {title || "Карточка доступа"}
            </h3>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 4 }}>
              Только админ. Партнёру Profi-пароль не показываем.
            </p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} style={{ ...miniBtn, padding: "6px 10px" }}>
              Закрыть
            </button>
          )}
        </div>
        <Row label="Email" value={card.email} />
        <Row label="Пароль входа" value={card.hubPassword} secret />
        <Row label="Profi логин" value={card.profiLogin} />
        <Row label="Profi пароль" value={card.profiPassword} secret />
        <Row label="VPS IP" value={card.vpsIp} />
        <Row label="SOURCE_ID" value={card.sourceId} />
        <Row label="Install" value={card.setupCommand} />
        <Row label="TG chat" value={card.telegramChatId} />
        <Row label="Лимит / мес" value={card.leadsPerMonth != null ? String(card.leadsPerMonth) : null} />
        <Row
          label="Часы сбора"
          value={card.workHoursStart && card.workHoursEnd ? `${card.workHoursStart}–${card.workHoursEnd} МСК` : null}
        />
        {!card.hubPassword && (
          <p style={{ fontSize: "var(--text-xs)", color: "var(--amber)", marginTop: 12 }}>
            Пароль входа в хаб не сохранён (есть только хеш). Новый задаётся при создании партнёра.
          </p>
        )}
      </div>
    </div>
  );
}
