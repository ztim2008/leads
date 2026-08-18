"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PartnerAccessCardModal from "@/components/admin/partner-access-card";
import type { PartnerAccessCard } from "@/lib/admin/access-card";

type Props = { onCreated?: () => void; showCancel?: boolean };

export default function AddPartnerForm({ onCreated, showCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [accessCard, setAccessCard] = useState<PartnerAccessCard | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setAccessCard(null);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, string | number> = {};
    fd.forEach((v, k) => {
      body[k] = v as string;
    });
    body.budgetMin = parseInt(String(body.budgetMin)) || 3000;
    body.budgetMax = parseInt(String(body.budgetMax)) || 500000;
    body.leadsPerMonth = parseInt(String(body.leadsPerMonth)) || 500;
    const res = await fetch("/api/admin/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (d.ok) {
      setMsg("Партнёр создан. Сохраните карточку доступа.");
      if (d.accessCard) setAccessCard(d.accessCard);
      onCreated?.();
      router.refresh();
    } else {
      setMsg(d.error || "Ошибка");
    }
    setLoading(false);
  }

  const i: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "var(--bg-root)",
    color: "var(--ink-body)",
    fontSize: "var(--text-sm)",
    outline: "none",
    boxSizing: "border-box",
  };
  const t: React.CSSProperties = { ...i, minHeight: 60, resize: "vertical" };
  const lbl: React.CSSProperties = { fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 4, display: "block" };
  const block: React.CSSProperties = {
    padding: "16px 18px",
    borderRadius: "var(--radius-lg)",
    border: "1px solid var(--border)",
    marginBottom: 16,
    background: "var(--bg-surface)",
  };
  const blockTitle: React.CSSProperties = { fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--ink-heading)", marginBottom: 12 };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div style={block}>
          <div style={blockTitle}>1. Аккаунт партнёра</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Email *</label>
              <input name="email" type="email" required style={i} placeholder="partner@email.ru" />
            </div>
            <div>
              <label style={lbl}>Имя</label>
              <input name="name" style={i} placeholder="Иван" />
            </div>
            <div>
              <label style={lbl}>Пароль для входа *</label>
              <input name="password" type="text" required style={i} placeholder="Сохраните и передадите партнёру" />
            </div>
            <div>
              <label style={lbl}>Лимит заявок / месяц *</label>
              <input name="leadsPerMonth" type="number" required defaultValue={500} style={i} />
              <span style={{ fontSize: "0.65rem", color: "var(--ink-muted)" }}>
                При исчерпании — сбор остановится. Счёт берёт цены из Счетов: подключение разово, API ИИ каждый месяц, поддержка со 2-го месяца, VPS по дням.
              </span>
            </div>
          </div>
        </div>

        <div style={block}>
          <div style={blockTitle}>2. Profi.ru (сбор на VPS партнёра)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Логин Profi *</label>
              <input name="profiLogin" required style={i} />
            </div>
            <div>
              <label style={lbl}>Пароль Profi *</label>
              <input name="profiPassword" type="password" required style={i} />
            </div>
            <div>
              <label style={lbl}>VPS IP</label>
              <input name="vpsIp" style={i} placeholder="159.194.213.198" />
            </div>
          </div>
        </div>

        <div style={block}>
          <div style={blockTitle}>3. Фильтры заявок</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Ключевые слова</label>
              <textarea name="keywords" style={t} placeholder="сайт, лендинг" />
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
          <div style={blockTitle}>4. Telegram</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Chat ID</label>
              <input name="telegramChatId" style={i} placeholder="@getmyid_bot" />
            </div>
            <div>
              <label style={lbl}>Bot Token</label>
              <input name="telegramToken" style={i} placeholder="@BotFather или токен сервиса" />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 24px",
              borderRadius: "var(--radius-sm)",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              fontWeight: 600,
              fontSize: "var(--text-sm)",
              cursor: "pointer",
            }}
          >
            {loading ? "Создаю…" : "Создать партнёра"}
          </button>
          {showCancel && (
            <Link
              href="/dashboard/admin"
              style={{
                padding: "12px 24px",
                color: "var(--ink-muted)",
                border: "1px solid var(--border)",
                fontSize: "var(--text-sm)",
                textDecoration: "none",
              }}
            >
              Отмена
            </Link>
          )}
          {msg && (
            <span style={{ fontSize: "var(--text-sm)", color: accessCard ? "var(--green)" : "var(--red)" }}>
              {msg}
            </span>
          )}
        </div>
      </form>
      {accessCard && (
        <PartnerAccessCardModal
          card={accessCard}
          title="Партнёр создан — карточка доступа"
          onClose={() => setAccessCard(null)}
        />
      )}
    </>
  );
}
