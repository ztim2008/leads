"use client";

import { useState, useRef, useEffect } from "react";
import ToggleSwitch from "@/components/ui/toggle-switch";
import { useRouter } from "next/navigation";

interface SettingsData {
  checkInterval: number;
  keywords: string;
  minusKeywords: string;
  budgetMin: number;
  budgetMax: number;
  showNoBudget: boolean;
  showOnlyWithReviews: boolean;
  minClientRating: number;
  workDays: string;
  workHoursStart: string;
  workHoursEnd: string;
  telegramToken: string;
  telegramChatId: string;
  telegramAlerts: boolean;
  responseTemplate: string;
  openrouterKey: string;
  yandexMetrika: string;
  yandexWebmaster: string;
  bodyCode: string;
}

type ToastState = { type: "success" | "error"; message: string } | null;


// ─── Клиентский DayPicker — визуальный отклик при клике ──────────────

const DAYS = [
  { key: "1", label: "Пн" }, { key: "2", label: "Вт" }, { key: "3", label: "Ср" },
  { key: "4", label: "Чт" }, { key: "5", label: "Пт" }, { key: "6", label: "Сб" }, { key: "0", label: "Вс" },
];

function DayPicker({ initialDays }: { initialDays: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialDays));
  const containerRef = useRef<HTMLDivElement>(null);

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Синхронизируем hidden inputs с состоянием через DOM
  useEffect(() => {
    if (!containerRef.current) return;
    DAYS.forEach(d => {
      const input = containerRef.current!.querySelector(`input[name="day_${d.key}"]`) as HTMLInputElement;
      if (input) input.checked = selected.has(d.key);
    });
  }, [selected]);

  return (
    <div ref={containerRef} style={{ display: "flex", gap: 6 }}>
      {DAYS.map(d => {
        const active = selected.has(d.key);
        return (
          <div key={d.key} style={{ position: "relative" }}>
            {/* Скрытый input для form submission — управляется через DOM */}
            <input
              name={`day_${d.key}`}
              type="checkbox"
              defaultChecked={initialDays.includes(d.key)}
              style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1 }}
              tabIndex={-1}
            />
            {/* Визуальная кнопка */}
            <div onClick={() => toggle(d.key)} style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 36, borderRadius: "var(--radius-sm)",
              border: active ? "2px solid var(--accent)" : "1px solid var(--border)",
              background: active ? "var(--accent-soft)" : "var(--bg-root)",
              cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 700,
              color: active ? "var(--accent)" : "var(--ink-muted)",
              transition: "0.15s", userSelect: "none",
            }}>
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}


export function SettingsFormWrapper({
  workspaceId, s, systemEnabled, isAdmin,
}: {
  workspaceId: string;
  s: SettingsData;
  systemEnabled: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastState>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function showToast(type: "success" | "error", message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const fd = new FormData(e.target as HTMLFormElement);

      // Дни недели
      const days = DAYS.filter(d => fd.get(`day_${d.key}`) === "on").map(d => d.key).join(",") || "1,2,3,4,5";

      const payload: Record<string, unknown> = {
        workspaceId,
        checkInterval: parseFloat(fd.get("checkInterval") as string) ?? 0,
        keywords: fd.get("keywords") || "",
        minusKeywords: fd.get("minusKeywords") || "",
        budgetMin: parseInt(fd.get("budgetMin") as string) || 5000,
        budgetMax: parseInt(fd.get("budgetMax") as string) || 500000,
        showNoBudget: fd.get("showNoBudget") === "on",
        showOnlyWithReviews: fd.get("showOnlyWithReviews") === "on",
        minClientRating: parseInt(fd.get("minClientRating") as string) || null,
        workDays: days,
        workHoursStart: fd.get("workHoursStart") || "09:00",
        workHoursEnd: fd.get("workHoursEnd") || "21:00",
        telegramToken: fd.get("telegramToken") || "",
        telegramChatId: fd.get("telegramChatId") || "",
        responseTemplate: (fd.get("responseTemplate") as string) || "",
        telegramAlerts: fd.get("telegramAlerts") === "on",
        openrouterKey: fd.get("openrouterKey") || "",
      };

      if (isAdmin) {
        payload.yandexMetrika = fd.get("yandexMetrika") || "";
        payload.yandexWebmaster = fd.get("yandexWebmaster") || "";
        payload.bodyCode = fd.get("bodyCode") || "";
      }

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.ok) {
        showToast("success", "✅ Настройки сохранены");
        router.refresh();
      } else {
        showToast("error", `❌ Ошибка: ${data.error || "не удалось сохранить"}`);
      }
    } catch (err: any) {
      showToast("error", `❌ Ошибка соединения: ${err.message || "попробуйте ещё раз"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          padding: "14px 22px", borderRadius: "var(--radius-md)",
          background: toast.type === "success" ? "#166534" : "#991b1b",
          color: "#fff", fontWeight: 600, fontSize: "var(--text-sm)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          display: "flex", alignItems: "center", gap: 10,
          animation: "slideUp 0.3s ease",
        }}>
          <span>{toast.message}</span>
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>

          {/* Ловец лидов — авто-сохранение через ToggleSwitch */}
          <div style={{ padding: "20px 24px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--ink-heading)" }}>Ловец лидов</p>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 2 }}>Выключите чтобы не тратить токены AI и не загружать базу</p>
            </div>
            <ToggleSwitch field="systemEnabled" defaultValue={systemEnabled} workspaceId={workspaceId} />
          </div>

          {/* 👀 Режим сбора */}
          <Section title="👀 Режим сбора" hint="Как система собирает заявки">
            <select name="checkInterval" defaultValue={s.checkInterval ?? 0} style={selectStyle}>
              <option value={0}>👀 Ждун — следит в реальном времени (рекомендуется)</option>
              <option value={-1}>🔄 Циклы — случайный интервал 1-25 мин</option>
            </select>
            {s.checkInterval === 0 && (
              <p style={{ fontSize: "var(--text-xs)", color: "var(--green)", marginTop: 6 }}>
                👀 Браузер открыт 1 раз. Сессия живёт часами. Новые заказы ловятся за 3-8 минут.
                Ночью (00:00-07:00 МСК) ждун отдыхает. Самый безопасный и быстрый режим.
              </p>
            )}
            {s.checkInterval === -1 && (
              <p style={{ fontSize: "var(--text-xs)", color: "var(--amber)", marginTop: 6 }}>
                🔄 Циклы: сервер заходит-выходит каждые 1-25 мин. Менее эффективно, больше запросов к Profi.
              </p>
            )}
          </Section>

          {/* 🕐 Расписание */}
          <Section title="🕐 Расписание работы" hint="В какие дни и часы система собирает заявки">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 8 }}>Дни работы</p>
                <DayPicker initialDays={s.workDays.split(",")} />
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                <div>
                  <label style={lbl}>С</label>
                  <input name="workHoursStart" type="time" defaultValue={s.workHoursStart} style={inpShort} />
                </div>
                <div>
                  <label style={lbl}>До</label>
                  <input name="workHoursEnd" type="time" defaultValue={s.workHoursEnd} style={inpShort} />
                </div>
              </div>
            </div>
          </Section>

          {/* 🎯 Ключевые слова */}
          <Section title="🎯 Ключевые слова" hint="Система покажет заявку только если в описании есть хотя бы одно слово">
            <input name="keywords" defaultValue={s.keywords} placeholder="сайт, лендинг, инфографика" style={inpFull} />
          </Section>

          {/* 🚫 Минус-слова */}
          <Section title="🚫 Минус-слова" hint="Заявки с этими словами будут скрыты">
            <input name="minusKeywords" defaultValue={s.minusKeywords} placeholder="wordpress, tilda, студент" style={inpFull} />
          </Section>

          {/* 💰 Бюджет */}
          <Section title="💰 Бюджет" hint="Диапазон бюджета в рублях">
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 14 }}>
              <div>
                <label style={lbl}>От (₽)</label>
                <input name="budgetMin" type="number" defaultValue={s.budgetMin} style={inpNum} />
              </div>
              <div>
                <label style={lbl}>До (₽)</label>
                <input name="budgetMax" type="number" defaultValue={s.budgetMax} style={inpNum} />
              </div>
            </div>
            <CheckField name="showNoBudget" label="Показывать заявки без бюджета" defaultChecked={s.showNoBudget} />
            <CheckField name="showOnlyWithReviews" label="Только заявки с отзывами ⭐ (Pro)" defaultChecked={s.showOnlyWithReviews} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
              <span style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}>Мин. рейтинг клиента:</span>
              <select name="minClientRating" defaultValue={s.minClientRating} style={selectShort}>
                <option value={0}>Без фильтра</option>
                <option value={1}>★☆☆ и выше</option>
                <option value={2}>★★☆ и выше</option>
                <option value={3}>★★★ только</option>
              </select>
            </div>
          </Section>

          {/* 📱 Telegram */}
          <div style={{ padding: "20px 24px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 650, marginBottom: 4 }}>📱 Telegram-уведомления</h3>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 16 }}>Заявки будут приходить мгновенно в ваш Telegram</p>

            <div style={{
              padding: "14px 16px", borderRadius: "var(--radius-sm)",
              background: "var(--bg-layer)", border: "1px solid var(--border)",
              marginBottom: 18, fontSize: "var(--text-xs)", lineHeight: 1.8, color: "var(--ink-body)",
            }}>
              <p style={{ fontWeight: 700, color: "var(--ink-heading)", marginBottom: 10, fontSize: "var(--text-sm)" }}>📖 Как подключить бота за 2 минуты</p>
              <Step num="1" title="Создать бота">
                Найдите <b>@BotFather</b> → <code>/newbot</code> → придумайте имя → скопируйте токен → вставьте ниже
              </Step>
              <Step num="2" title="Активировать бота">
                Найдите своего бота в Telegram → напишите ему «Привет» → ⚠️ <b>Без этого бот не сможет вам писать!</b>
              </Step>
              <Step num="3" title="Узнать Chat ID">
                Найдите <b>@getmyid_bot</b> → <code>/start</code> → скопируйте число → вставьте ниже
              </Step>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              <div>
                <label style={lbl}>🤖 Bot Token</label>
                <input name="telegramToken" defaultValue={s.telegramToken} placeholder="1234567890:ABCdefGHIjkl..." style={inpFull} />
              </div>
              <div>
                <label style={lbl}>📱 Chat ID</label>
                <input name="telegramChatId" defaultValue={s.telegramChatId} placeholder="778784292" style={inpFull} />
              </div>
            </div>
            <CheckField name="telegramAlerts" label="Присылать новые заявки в Telegram" defaultChecked={s.telegramAlerts} />
{/* ✍️ Шаблон отклика */}
          <Section title="✍️ Шаблон отклика" hint="Текст для авто-отклика. Нажмите кнопку чтобы вставить переменную.">
            {/* Быстрые кнопки */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {[
                { v: "{имя}",   e: "👤", l: "Имя" },
                { v: "{задача}", e: "📋", l: "Задача" },
                { v: "{город}", e: "📍", l: "Город" },
                { v: "{бюджет}", e: "💰", l: "Бюджет" },
                { v: "{стаж}",  e: "📅", l: "Стаж" },
                { v: "{отзывы}", e: "⭐", l: "Отзывы" },
                { v: "{цена_отклика}", e: "🎯", l: "Цена отклика" },
                { v: "{ссылка}", e: "🔗", l: "Ссылка" },
              ].map((btn) => (
                <span key={btn.v} onClick={() => {
                  const ta = document.querySelector("textarea[name=responseTemplate]") as HTMLTextAreaElement;
                  if (ta) {
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const before = ta.value.substring(0, start);
                    const after = ta.value.substring(end);
                    ta.value = before + btn.v + after;
                    ta.selectionStart = ta.selectionEnd = start + btn.v.length;
                    ta.focus();
                    ta.dispatchEvent(new Event("input", { bubbles: true }));
                  }
                }} style={{
                  cursor: "pointer", padding: "5px 10px", borderRadius: 100,
                  border: "1px solid var(--border)", background: "var(--bg-layer)",
                  color: "var(--ink-body)", fontSize: "0.75rem", fontWeight: 600,
                  userSelect: "none", whiteSpace: "nowrap",
                }} title={btn.l}>{btn.e} {btn.l}</span>
              ))}
            </div>

            {/* Текстовое поле */}
            <textarea name="responseTemplate" defaultValue={s.responseTemplate || ""}
              placeholder="Здравствуйте, {имя}! Готов выполнить {задача}. Опыт {стаж}."
              onChange={(e) => {
                const preview = document.getElementById("resp-preview");
                if (preview) preview.textContent = (e.target as HTMLTextAreaElement).value;
              }}
              style={{ width: "100%", minHeight: 100, padding: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-root)", color: "var(--ink-body)", fontSize: "var(--text-sm)", fontFamily: "var(--font-mono)", resize: "vertical" }}
            />

            {/* Живой предпросмотр */}
            <div id="resp-preview-wrap" style={{ marginTop: 10, padding: 14, borderRadius: "var(--radius-sm)", background: "#1a1a2e", border: "1px solid #2a2a4e", fontSize: "0.8rem", lineHeight: 1.6, color: "#e0e0e0" }}>
              <div style={{ fontSize: "0.65rem", color: "#666", marginBottom: 6, textTransform: "uppercase" }}>📱 Предпросмотр в Telegram</div>
              <div id="resp-preview" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {s.responseTemplate || "Напишите шаблон выше..."}
              </div>
              <div style={{ fontSize: "0.6rem", color: "#555", marginTop: 8 }}>
                👤 Ангелина &nbsp;|&nbsp; 📍 Москва &nbsp;|&nbsp; 📅 5 лет &nbsp;|&nbsp; ⭐ 12 отз. &nbsp;|&nbsp; 💰 50 000 ₽ &nbsp;|&nbsp; 🎯 149 ₽
              </div>
            </div>

            {s.responseTemplate && s.responseTemplate.includes("{") ? (
              <p style={{ fontSize: "var(--text-xs)", color: "var(--green)", marginTop: 6 }}>
                ✅ Шаблон активен. Текст уникализируется под каждую заявку.
              </p>
            ) : (
              <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 6 }}>
                💡 Оставьте пустым если не нужен. Текст придет в Telegram — партнёр скопирует и отправит сам.
              </p>
            )}
          </Section>
          </div>

          {/* 🤖 OpenRouter */}
          <Section title="🤖 OpenRouter ключ" hint="Для AI-анализа. Получить на openrouter.ai/keys" last>
            <input name="openrouterKey" defaultValue={s.openrouterKey} placeholder="sk-or-v1-..." style={inpFull} />
          </Section>

          {/* ═══ SEO (только админ) ═══ */}
          {isAdmin && (
            <>
              <Section title="📊 Яндекс Метрика" hint="ID счётчика для отслеживания посещаемости">
                <input name="yandexMetrika" defaultValue={s.yandexMetrika} placeholder="98765432" style={inpFull} />
              </Section>
              <Section title="🔍 Яндекс Вебмастер" hint="Код подтверждения прав на сайт">
                <input name="yandexWebmaster" defaultValue={s.yandexWebmaster} placeholder="<meta name=verification>" style={inpFull} />
              </Section>
              <Section title="📝 Код в body" hint="HTML/JS перед закрывающим body. Счётчики, виджеты." last>
                <input name="bodyCode" defaultValue={s.bodyCode} placeholder="<script src=...></script>" style={inpFull} />
              </Section>
            </>
          )}

          {/* ═══ КНОПКА СОХРАНИТЬ ВСЁ ═══ */}
          <div style={{
            padding: "20px 24px", background: "var(--bg-layer)",
            borderTop: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <button type="submit" disabled={saving} style={{
              padding: "14px 48px", borderRadius: "var(--radius-md)",
              border: "none", background: saving ? "var(--ink-muted)" : "var(--accent)",
              color: "#fff", fontWeight: 700, fontSize: "var(--text-base)", cursor: saving ? "not-allowed" : "pointer",
              transition: "0.2s", opacity: saving ? 0.7 : 1,
            }}>
              {saving ? "⏳ Сохраняем..." : "💾 Сохранить все настройки"}
            </button>
          </div>
        </div>
      </form>

      {/* CSS-анимация для toast */}
      <style jsx global>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}

// ─── Вспомогательные компоненты ─────────────────────────────────────────

function Section({ title, hint, children, last }: { title: string; hint?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ padding: "20px 24px", background: "var(--bg-surface)", borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 650, marginBottom: hint ? 4 : 14 }}>{title}</h3>
      {hint && <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 14 }}>{hint}</p>}
      {children}
    </div>
  );
}

function CheckField({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "var(--text-sm)", color: "var(--ink-body)", marginTop: 10 }}>
      <input name={name} type="checkbox" defaultChecked={defaultChecked} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
      {label}
    </label>
  );
}

function Step({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontWeight: 650, color: "var(--accent)", marginBottom: 4 }}>Шаг {num} — {title}</p>
      <p style={{ paddingLeft: 0, margin: 0 }}>{children}</p>
    </div>
  );
}

// ─── Стили полей ────────────────────────────────────────────────────────

const lbl: React.CSSProperties = {
  display: "block", fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 4, fontWeight: 500,
};

const inpFull: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)", background: "var(--bg-root)",
  color: "var(--ink-body)", fontSize: "var(--text-sm)", outline: "none", boxSizing: "border-box",
};

const inpNum: React.CSSProperties = {
  width: 140, padding: "10px 14px", borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)", background: "var(--bg-root)",
  color: "var(--ink-body)", fontSize: "var(--text-sm)", outline: "none",
};

const inpShort: React.CSSProperties = {
  padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
  background: "var(--bg-root)", color: "var(--ink-body)", fontSize: "var(--text-sm)", outline: "none",
};

const selectStyle: React.CSSProperties = {
  padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
  background: "var(--bg-root)", color: "var(--ink-body)", fontSize: "var(--text-sm)", outline: "none",
};

const selectShort: React.CSSProperties = {
  padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
  background: "var(--bg-root)", color: "var(--ink-body)", fontSize: "var(--text-sm)",
};
