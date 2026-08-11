"use client";

import { useCallback, useEffect, useState } from "react";
import AddPartnerButton from "./add-partner-button";
import {
  computeOnboardingSteps,
  onboardingPhase,
  onboardingProgress,
  type OnboardingStep,
} from "@/lib/agent/onboarding-steps";

interface PartnerRow {
  id: string;
  email: string;
  name: string;
  workspace?: {
    leadsCount: number;
    settings?: { telegramChatId?: string; telegramToken?: string };
    sources?: Array<{
      id: string;
      enabled: boolean;
      setupCommand?: string | null;
      config?: {
        login?: string;
        _profiConfigured?: boolean;
        _vpsIp?: string;
        _onboardingVpsReady?: boolean;
      };
      agentStatus?: {
        online: boolean;
        lastHeartbeat?: string | null;
        uptime?: number;
        leads?: number;
        lastError?: string | null;
        lifecycle?: string;
        circuitBreaker?: { state?: string } | null;
        version?: number;
      };
    }>;
  } | null;
}

function copyText(text: string) {
  return navigator.clipboard.writeText(text);
}

function StepList({ steps }: { steps: OnboardingStep[] }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {steps.map((s) => (
        <li
          key={s.id}
          style={{
            display: "flex",
            gap: 10,
            padding: "8px 0",
            borderBottom: "1px solid var(--border-light)",
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: "1rem", lineHeight: 1.2 }}>{s.done ? "✅" : s.current ? "👉" : "⬜"}</span>
          <div>
            <p
              style={{
                fontWeight: s.current ? 650 : 500,
                fontSize: "var(--text-xs)",
                color: s.done ? "var(--green)" : "var(--ink-heading)",
                marginBottom: 2,
              }}
            >
              {s.title}
            </p>
            <p style={{ fontSize: "0.65rem", color: "var(--ink-muted)", lineHeight: 1.4 }}>{s.hint}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ManualGuide({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", background: "var(--bg-surface)", marginBottom: 20 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "14px 20px",
          border: "none",
          background: "transparent",
          textAlign: "left",
          cursor: "pointer",
          fontWeight: 650,
          fontSize: "var(--text-sm)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>📖 Мануал: как подключить партнёра и VPS (первый раз)</span>
        <span style={{ color: "var(--ink-muted)" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 20px 20px", fontSize: "var(--text-xs)", color: "var(--ink-body)", lineHeight: 1.55 }}>
          <p style={{ marginBottom: 12, color: "var(--ink-muted)" }}>
            Подключение только через вас (админ). Партнёр не регистрируется сам — вы создаёте аккаунт и настраиваете сбор.
            Profi.ru работает <strong>только на VPS партнёра</strong>, не на этом сервере.
          </p>

          <h4 style={{ fontWeight: 700, margin: "16px 0 8px" }}>Шаг 0 — Соберите от партнёра</h4>
          <ul style={{ margin: "0 0 12px", paddingLeft: 18 }}>
            <li>Логин и пароль кабинета специалиста Profi.ru</li>
            <li>Ниша и ключевые слова для фильтра заявок</li>
            <li>Telegram: бот от @BotFather + Chat ID от @getmyid_bot</li>
            <li>(Опционально) VPS — партнёр может купить сам или вы купите для него</li>
          </ul>

          <h4 style={{ fontWeight: 700, margin: "16px 0 8px" }}>Шаг 1 — Создать партнёра в админке</h4>
          <p>Форма ниже: email + пароль для входа партнёра в <code>/dashboard</code>. Profi и Telegram — в той же форме.</p>
          <p style={{ color: "var(--amber)", marginTop: 6 }}>
            ⚠️ Запишите пароль партнёра — в системе он не показывается повторно.
          </p>

          <h4 style={{ fontWeight: 700, margin: "16px 0 8px" }}>Шаг 2 — VPS</h4>
          <ul style={{ margin: "0 0 12px", paddingLeft: 18 }}>
            <li>Минимум: 4 GB RAM, 2 vCPU, Ubuntu 24.04</li>
            <li>Локация: Казахстан или РФ (прямой доступ к Profi и Telegram)</li>
            <li>Домен не нужен — только IP</li>
          </ul>
          <p>После покупки: <code>ssh root@IP_ВАШЕГО_VPS</code> (пароль из письма провайдера).</p>

          <h4 style={{ fontWeight: 700, margin: "16px 0 8px" }}>Шаг 3 — Установка агента (одна команда)</h4>
          <p>На VPS выполните команду из карточки партнёра (кнопка «Скопировать»). Пример:</p>
          <pre
            style={{
              background: "var(--bg-root)",
              padding: 12,
              borderRadius: 8,
              fontSize: "0.7rem",
              overflow: "auto",
              border: "1px solid var(--border)",
            }}
          >
            curl -fsSL https://leads.konversus.ru/agent/v2/install.sh | bash -s &quot;SOURCE_ID&quot;
          </pre>
          <p>Установка ~3–5 мин: Node 22, Playwright, Chromium, PM2 процесс <code>leads-agent-v2</code>.</p>

          <h4 style={{ fontWeight: 700, margin: "16px 0 8px" }}>Шаг 4 — Проверка на VPS</h4>
          <pre style={{ background: "var(--bg-root)", padding: 12, borderRadius: 8, fontSize: "0.7rem", border: "1px solid var(--border)" }}>
            pm2 status          # leads-agent-v2 → online{"\n"}
            pm2 logs leads-agent-v2 --lines 30   # без красных ошибок{"\n"}
            curl -I https://leads.konversus.ru   # с VPS должен быть 200
          </pre>

          <h4 style={{ fontWeight: 700, margin: "16px 0 8px" }}>Шаг 5 — Проверка в админке</h4>
          <ul style={{ margin: "0 0 12px", paddingLeft: 18 }}>
            <li>Карточка партнёра: чеклист шагов зелёные</li>
            <li>Статус «🟢 Онлайн», heartbeat &lt; 15 мин</li>
            <li>Кнопка 🧪 — тест Telegram</li>
            <li>«Обновить статус» — если только что установили агент</li>
          </ul>

          <h4 style={{ fontWeight: 700, margin: "16px 0 8px" }}>Шаг 6 — Передать партнёру</h4>
          <p>
            Ссылка <code>https://leads.konversus.ru/auth</code>, email и пароль. Партнёр видит только заявки — настройки не трогает.
          </p>

          <h4 style={{ fontWeight: 700, margin: "16px 0 8px" }}>Если что-то не так</h4>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              <strong>Нет heartbeat</strong> — firewall, нет интернета на VPS, неверный SOURCE_ID в .env
            </li>
            <li>
              <strong>Ошибка входа Profi</strong> — SMS/капча на Profi; агент остановится (circuit breaker), не рестартить вручную десятки раз
            </li>
            <li>
              <strong>CB OPEN</strong> — ждать кулдаун 60 мин или разблокировать вручную после проверки аккаунта
            </li>
            <li>
              <strong>Никогда</strong> запускать Profi Playwright на хабе leads.konversus.ru
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

function PartnerCard({
  partner,
  onRefresh,
}: {
  partner: PartnerRow;
  onRefresh: () => void;
}) {
  const ws = partner.workspace;
  const source = ws?.sources?.[0];
  const steps = computeOnboardingSteps(partner);
  const progress = onboardingProgress(steps);
  const phase = onboardingPhase(steps);
  const [vpsIp, setVpsIp] = useState(source?.config?._vpsIp || "");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    setVpsIp(source?.config?._vpsIp || "");
  }, [source?.config?._vpsIp]);

  async function saveVps() {
    if (!source) return;
    setSaving(true);
    await fetch("/api/admin/partners/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: source.id,
        vpsIp,
        markVpsReady: vpsIp.trim().length > 0,
      }),
    });
    setSaving(false);
    onRefresh();
  }

  async function testTg() {
    await fetch("/api/admin/test-telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: partner.email }),
    });
    alert("Запрос отправлен — проверьте Telegram партнёра");
  }

  const a = source?.agentStatus;
  const cb = a?.circuitBreaker?.state;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
        background: "var(--bg-layer)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>{partner.name || partner.email}</p>
          <p style={{ fontSize: "0.65rem", color: "var(--ink-muted)" }}>{partner.email}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--accent)" }}>{phase}</p>
          <p style={{ fontSize: "0.65rem", color: "var(--ink-muted)" }}>{progress}% · {ws?.leadsCount || 0} заявок</p>
        </div>
      </div>

      <div
        style={{
          height: 6,
          background: "var(--bg-hover)",
          borderRadius: 99,
          marginBottom: 14,
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${progress}%`, height: "100%", background: "var(--green)", transition: "width 0.3s" }} />
      </div>

      {source && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 8,
            marginBottom: 14,
            fontSize: "0.65rem",
          }}
        >
          <span>
            Агент:{" "}
            <strong style={{ color: a?.online ? "var(--green)" : "var(--ink-muted)" }}>
              {a?.online ? "🟢 онлайн" : "⚫ нет связи"}
            </strong>
          </span>
          <span>v{a?.version || 1}</span>
          <span>CB: {cb || "—"}</span>
          <span>Profi: {source.config?.login || "—"}</span>
        </div>
      )}

      {source?.setupCommand && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: "0.65rem", color: "var(--ink-muted)", marginBottom: 6 }}>Команда для VPS (SOURCE_ID встроен):</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <code
              style={{
                flex: 1,
                fontSize: "0.65rem",
                padding: 8,
                background: "var(--bg-root)",
                borderRadius: 6,
                border: "1px solid var(--border)",
                wordBreak: "break-all",
              }}
            >
              {source.setupCommand}
            </code>
            <button
              type="button"
              onClick={() => {
                copyText(source.setupCommand!);
                setCopied("cmd");
                setTimeout(() => setCopied(""), 2000);
              }}
              style={miniBtn}
            >
              {copied === "cmd" ? "✅" : "📋"} Команда
            </button>
            <button
              type="button"
              onClick={() => {
                copyText(source.id);
                setCopied("id");
                setTimeout(() => setCopied(""), 2000);
              }}
              style={miniBtn}
            >
              {copied === "id" ? "✅" : "ID"}
            </button>
            {vpsIp && (
              <button
                type="button"
                onClick={() => {
                  copyText(`ssh root@${vpsIp}`);
                  setCopied("ssh");
                  setTimeout(() => setCopied(""), 2000);
                }}
                style={miniBtn}
              >
                {copied === "ssh" ? "✅" : "SSH"}
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={vpsIp}
          onChange={(e) => setVpsIp(e.target.value)}
          placeholder="IP VPS (185.x.x.x)"
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            fontSize: "0.7rem",
            minWidth: 140,
          }}
        />
        <button type="button" onClick={saveVps} disabled={saving} style={miniBtn}>
          {saving ? "…" : "💾 IP VPS"}
        </button>
        <button type="button" onClick={onRefresh} style={miniBtn}>🔄 Обновить</button>
        <button type="button" onClick={testTg} style={miniBtn}>🧪 TG</button>
      </div>

      <StepList steps={steps} />
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
  fontSize: "0.65rem",
  cursor: "pointer",
  fontWeight: 600,
};

export default function PartnerOnboardingHub() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualOpen, setManualOpen] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/partners")
      .then((r) => r.json())
      .then((d) => {
        setPartners(d.partners || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: 4 }}>🔌 Подключение партнёра</h2>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
          Вы подключаете партнёров вручную. Следуйте мануалу и чеклисту в карточке — статус обновляется автоматически.
        </p>
      </div>

      <ManualGuide open={manualOpen} onToggle={() => setManualOpen(!manualOpen)} />

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-surface)",
          marginBottom: 20,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--border)",
            fontWeight: 650,
            fontSize: "var(--text-sm)",
          }}
        >
          1. Создать нового партнёра
        </div>
        <div style={{ padding: "16px 20px" }}>
          <AddPartnerButton onCreated={load} />
        </div>
      </div>

      <div style={{ marginBottom: 12, fontWeight: 650, fontSize: "var(--text-sm)" }}>
        2. Прогресс подключения {partners.length > 0 ? `(${partners.length})` : ""}
      </div>

      {loading && partners.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}>Загрузка…</p>
      ) : partners.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)", padding: 16, border: "1px dashed var(--border)", borderRadius: 12 }}>
          Партнёров ещё нет — создайте первого в форме выше.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {partners.map((p) => (
            <PartnerCard key={p.id} partner={p} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
}
