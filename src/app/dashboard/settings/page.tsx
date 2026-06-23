// Страница настроек + управление системой
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import ResetButton from "./reset-button";
import ToggleSwitch from "@/components/ui/toggle-switch";
import { SettingsFormWrapper } from "./settings-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const workspace = await db.workspace.findFirst({ where: { userId: (session.user as any).id } });
  if (!workspace) return null;

  let s = await db.settings.findUnique({ where: { workspaceId: workspace.id } });
  if (!s) s = await db.settings.create({ data: { workspaceId: workspace.id } });

  const totalLeads = await db.lead.count({ where: { workspaceId: workspace.id } });

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 4 }}>Настройки</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginBottom: 32 }}>Фильтры, интеграции, управление</p>

      {/* ═══ РЕКОМЕНДАЦИИ ПО НАСТРОЙКАМ ═══ */}
      <div style={{
        marginBottom: 24, padding: "24px 28px", borderRadius: "var(--radius-lg)",
        background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
        border: "1px solid #86efac",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 24 }}>🛡️</span>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "#166534", margin: 0 }}>Рекомендации по настройкам</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <Card title="⏱ Интервал опроса">
            Используйте <b>🎲 Случайный (1-25 мин)</b> — это единственный безопасный режим.
            Система сама выбирает интервал из пула, Profi не видит закономерности.
            <br /><br />
            ⚠️ <b>Никогда не ставьте меньше 5 минут</b> — слишком частые проверки вызывают блокировку аккаунта.
          </Card>
          <Card title="🎯 Ключевые слова">
            Пишите <b>только те слова</b>, которые точно есть в ваших целевых заказах.
            Чем точнее фильтр — тем меньше мусорных заявок и тем реже система ходит в Profi.
            <br /><br />
            Пример: не «дизайн», а «веб-дизайн интернет-магазина».
          </Card>
          <Card title="🚫 Минус-слова">
            Добавляйте сюда всё, что вам <b>не подходит</b>: WordPress, Tilda, студенты, курсовые, бесплатно, за отзыв.
            <br /><br />
            Каждое минус-слово экономит один deep scan (открытие заказа) — а значит меньше запросов к Profi.
          </Card>
          <Card title="⭐ Отзывы и рейтинг">
            Включите <b>«Только заявки с отзывами»</b> и поставьте минимальный рейтинг клиента — это отсеет 70% мусора.
            <br /><br />
            А главное — система будет делать deep scan только для качественных заявок, снижая нагрузку на Profi.
          </Card>
          <Card title="💰 Бюджет">
            Укажите реальный диапазон. Слишком широкий (от 500 до 500 000 ₽) — получите сотни неподходящих заявок.
            <br /><br />
            Рекомендуем: от 5 000–15 000 ₽ (нижняя граница) до 100 000–300 000 ₽ (верхняя).
          </Card>
          <Card title="🕐 Как работает сбор">
            <b>8:00–22:00 МСК</b> — активный опрос, случайный интервал 1–25 мин.<br />
            <b>22:00–8:00 МСК</b> — редкие проверки, раз в 2–3 часа.<br />
            <b>20% циклов</b> — намеренно пропускаются (имитация «занят»).<br />
            Система имитирует поведение живого человека: читает сообщения, листает ленту, смотрит случайные заказы.
          </Card>
        </div>
      </div>

      {/* ═══ ФОРМА ВСЕХ НАСТРОЕК ═══ */}
      <SettingsFormWrapper
        workspaceId={workspace.id}
        s={{
          checkInterval: s.checkInterval ?? 0,
          keywords: s.keywords || "",
          minusKeywords: s.minusKeywords || "",
          budgetMin: s.budgetMin || 5000,
          budgetMax: s.budgetMax || 500000,
          showNoBudget: s.showNoBudget !== false,
          showOnlyWithReviews: s.showOnlyWithReviews === true,
          minClientRating: s.minClientRating || 0,
          workDays: s.workDays || "1,2,3,4,5",
          workHoursStart: s.workHoursStart || "09:00",
          workHoursEnd: s.workHoursEnd || "21:00",
          telegramToken: s.telegramToken || "",
          telegramChatId: s.telegramChatId || "",
          telegramAlerts: s.telegramAlerts !== false,
          openrouterKey: s.openrouterKey || "",
          yandexMetrika: s.yandexMetrika || "",
          yandexWebmaster: s.yandexWebmaster || "",
          bodyCode: s.bodyCode || "",
        }}
        systemEnabled={s.systemEnabled}
        isAdmin={(session.user as any)?.email === "bilariuss@yandex.ru"}
      />

      {/* ═══ Опасная зона ═══ */}
      <div style={{ marginTop: 32, border: "1px solid var(--red)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-surface)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--red)" }}>
          <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 650, color: "var(--red)", marginBottom: 4 }}>💣 Жёсткий сброс</h3>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
            Удаляет ВСЕ заявки и AI-анализы. Настройки и источники сохраняются.
            Сейчас в базе: <b>{totalLeads} заявок</b>.
          </p>
        </div>
        <div style={{ padding: "16px 24px" }}>
          <ResetButton workspaceId={workspace.id} />
        </div>
      </div>
    </div>
  );
}

// ─── Мини-компонент для карточек рекомендаций ────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "14px 16px", borderRadius: "var(--radius-sm)", background: "#fff", border: "1px solid #bbf7d0" }}>
      <p style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "#166534", marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: "var(--text-xs)", color: "#166534", lineHeight: 1.6, margin: 0 }}>{children}</p>
    </div>
  );
}
