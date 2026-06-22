// Страница настроек + управление системой
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import ResetButton from "./reset-button";
import ToggleSwitch from "@/components/ui/toggle-switch";

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

      <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>

          <form style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--ink-heading)" }}>Ловец лидов</p>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 2 }}>Выключите чтобы не тратить токены AI и не загружать базу</p>
            </div>
            <ToggleSwitch field="systemEnabled" defaultValue={s.systemEnabled} workspaceId={workspace.id} />
          </form>

        {/* Интервал опроса */}
        <Section title="⏱ Интервал опроса" hint="Как часто проверять новые заявки">
          <form action={async (fd: FormData) => {
            "use server";
            const val = parseFloat(fd.get("checkInterval") as string) || 3;
            await db.settings.update({ where: { workspaceId: workspace.id }, data: { checkInterval: val } });
            revalidatePath("/dashboard/settings");
          }} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <select name="checkInterval" defaultValue={s.checkInterval || 3} style={{ padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-root)", color: "var(--ink-body)", fontSize: "var(--text-sm)", outline: "none" }}>
              <option value={0.25}>15 секунд (макс. скорость)</option>
              <option value={0.5}>30 секунд</option>
              <option value={1}>1 минута</option>
              <option value={2}>2 минуты</option>
              <option value={3}>3 минуты</option>
              <option value={5}>5 минут</option>
              <option value={10}>10 минут</option>
              <option value={15}>15 минут</option>
            </select>
            <SaveBtn />
          </form>
        </Section>
        {/* ═══ Расписание ═══ */}
        <Section title="🕐 Расписание работы" hint="В какие дни и часы система собирает заявки">
          <ScheduleForm s={s} workspaceId={workspace.id} />
        </Section>

        {/* ═══ Фильтры ═══ */}
        <Section title="🎯 Ключевые слова">
          <TextForm field="keywords" defaultValue={s.keywords || ""} placeholder="сайт, лендинг, инфографика" workspaceId={workspace.id} />
        </Section>
        <Section title="🚫 Минус-слова">
          <TextForm field="minusKeywords" defaultValue={s.minusKeywords || ""} placeholder="wordpress, tilda" workspaceId={workspace.id} />
        </Section>
        <Section title="💰 Бюджет">
          <BudgetForm s={s} workspaceId={workspace.id} />
          <form action={async (fd: FormData) => {
            "use server";
            const val = fd.get("showNoBudget") === "on";
            await db.settings.update({ where: { workspaceId: workspace.id }, data: { showNoBudget: val } });
            revalidatePath("/dashboard/settings");
          }} style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "var(--text-sm)", color: "var(--ink-body)" }}>
              <input name="showNoBudget" type="checkbox" defaultChecked={s.showNoBudget !== false} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
              Показывать заявки без бюджета
            </label>
            <SaveBtn />
          </form>
          <form action={async (fd: FormData) => {
            "use server";
            const val = fd.get("showOnlyWithReviews") === "on";
            await db.settings.update({ where: { workspaceId: workspace.id }, data: { showOnlyWithReviews: val } });
            revalidatePath("/dashboard/settings");
          }} style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "var(--text-sm)", color: "var(--ink-body)" }}>
              <input name="showOnlyWithReviews" type="checkbox" defaultChecked={s.showOnlyWithReviews === true} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
              Только заявки с отзывами ⭐ (Pro)
            </label>
            <SaveBtn />
          </form>
        </Section>

        {/* ═══ Интеграции: Telegram ═══ */}
        <div style={{ padding: "20px 24px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 650, marginBottom: 4 }}>📱 Telegram-уведомления</h3>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 16 }}>Заявки будут приходить мгновенно в ваш Telegram</p>

          {/* Инструкция по шагам */}
          <div style={{
            padding: "14px 16px", borderRadius: "var(--radius-sm)",
            background: "var(--bg-layer)", border: "1px solid var(--border)",
            marginBottom: 18, fontSize: "var(--text-xs)", lineHeight: 1.8, color: "var(--ink-body)",
          }}>
            <p style={{ fontWeight: 700, color: "var(--ink-heading)", marginBottom: 10, fontSize: "var(--text-sm)" }}>📖 Как подключить бота за 2 минуты</p>
            
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontWeight: 650, color: "var(--accent)", marginBottom: 4 }}>Шаг 1 — Создать бота</p>
              <ol style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <li>Откройте Telegram → найдите <b>@BotFather</b></li>
                <li>Напишите команду <code style={{background:"var(--bg-root)",padding:"1px 5px",borderRadius:3}}>/newbot</code></li>
                <li>Придумайте имя боту (например: «Заявки Насти»)</li>
                <li>Придумайте username (например: <code style={{background:"var(--bg-root)",padding:"1px 5px",borderRadius:3}}>NastyaLeadsBot</code>)</li>
                <li>BotFather пришлёт токен — скопируйте его</li>
                <li>Вставьте токен в поле «Bot Token» ниже</li>
              </ol>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontWeight: 650, color: "var(--accent)", marginBottom: 4 }}>Шаг 2 — Активировать бота</p>
              <ol style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <li>Найдите вашего бота в Telegram (по username из шага 1)</li>
                <li>Напишите ему любое сообщение (например: «Привет»)</li>
                <li>⚠️ <b>Без этого бот не сможет вам писать!</b></li>
              </ol>
            </div>

            <div>
              <p style={{ fontWeight: 650, color: "var(--accent)", marginBottom: 4 }}>Шаг 3 — Узнать Chat ID</p>
              <ol style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <li>Найдите <b>@getmyid_bot</b> в Telegram</li>
                <li>Напишите <code style={{background:"var(--bg-root)",padding:"1px 5px",borderRadius:3}}>/start</code></li>
                <li>Бот ответит числом — это ваш Chat ID</li>
                <li>Вставьте его в поле «Chat ID» ниже</li>
              </ol>
            </div>
          </div>

          {/* Поля ввода */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
            <TextForm field="telegramToken" defaultValue={s.telegramToken || ""} placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz" workspaceId={workspace.id} prefix="🤖 Bot Token" />
            <TextForm field="telegramChatId" defaultValue={s.telegramChatId || ""} placeholder="778784292" workspaceId={workspace.id} prefix="📱 Chat ID" />
          </div>

          {/* Выключатель */}
          <form action={async (fd: FormData) => {
            "use server";
            const val = fd.get("telegramAlerts") === "on";
            await db.settings.update({ where: { workspaceId: workspace.id }, data: { telegramAlerts: val } });
            revalidatePath("/dashboard/settings");
          }} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "var(--text-sm)", color: "var(--ink-body)" }}>
              <input name="telegramAlerts" type="checkbox" defaultChecked={s.telegramAlerts !== false} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
              Присылать новые заявки в Telegram
            </label>
            <SaveBtn />
          </form>
        </div>
        <Section title="🤖 OpenRouter ключ" hint="Для AI-анализа. openrouter.ai/keys" last>
          <TextForm field="openrouterKey" defaultValue={s.openrouterKey || ""} placeholder="sk-or-v1-..." workspaceId={workspace.id} />
        </Section>
      </div>
      {/* ═══ SEO (только админ) ═══ */}
      {(session.user as any)?.email === "bilariuss@yandex.ru" && (
        <>
          <Section title="📊 Яндекс Метрика" hint="ID счётчика для отслеживания посещаемости">
            <TextForm field="yandexMetrika" defaultValue={s.yandexMetrika || ""} placeholder="98765432" workspaceId={workspace.id} />
          </Section>
          <Section title="🔍 Яндекс Вебмастер" hint="Код подтверждения прав на сайт">
            <TextForm field="yandexWebmaster" defaultValue={s.yandexWebmaster || ""} placeholder="<meta name=verification>" workspaceId={workspace.id} />
          </Section>
          <Section title="📝 Код в body" hint="HTML/JS перед закрывающим body. Счётчики, виджеты." last>
            <TextForm field="bodyCode" defaultValue={s.bodyCode || ""} placeholder="<script src=...></script>" workspaceId={workspace.id} />
          </Section>
        </>
      )}


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

function TextForm({ field, defaultValue, placeholder, workspaceId, prefix }: { field: string; defaultValue: string; placeholder: string; workspaceId: string; prefix?: string }) {
  return (
    <form action={async (fd: FormData) => {
      "use server";
      await db.settings.update({ where: { workspaceId }, data: { [field]: fd.get(field) || "" } });
      revalidatePath("/dashboard/settings");
    }} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {prefix && <label style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 4, fontWeight: 500 }}>{prefix}</label>}
      <div style={{ display: "flex", gap: 10 }}>
        <input name={field} defaultValue={defaultValue} placeholder={placeholder} style={{ flex: 1, padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-root)", color: "var(--ink-body)", fontSize: "var(--text-sm)", outline: "none" }} />
        <SaveBtn />
      </div>
    </form>
  );
}

function BudgetForm({ s, workspaceId }: { s: any; workspaceId: string }) {
  return (
    <form action={async (fd: FormData) => {
      "use server";
      await db.settings.update({ where: { workspaceId }, data: { budgetMin: parseInt(fd.get("budgetMin") as string) || 3000, budgetMax: parseInt(fd.get("budgetMax") as string) || 500000 } });
      revalidatePath("/dashboard/settings");
    }} style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
      <div><label style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 4 }}>От (₽)</label><input name="budgetMin" type="number" defaultValue={s.budgetMin || 3000} style={{ width: 140, padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-root)", color: "var(--ink-body)", fontSize: "var(--text-sm)", outline: "none" }} /></div>
      <div><label style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 4 }}>До (₽)</label><input name="budgetMax" type="number" defaultValue={s.budgetMax || 500000} style={{ width: 140, padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-root)", color: "var(--ink-body)", fontSize: "var(--text-sm)", outline: "none" }} /></div>
      <SaveBtn />
    </form>
  );
}

function ToggleForm({ label, hint, field, defaultValue, workspaceId }: { label: string; hint: string; field: string; defaultValue: boolean; workspaceId: string }) {
  return (
    <form action={async (fd: FormData) => {
      "use server";
      const val = fd.get(field) === "on";
      await db.settings.update({ where: { workspaceId }, data: { [field]: val } });
      revalidatePath("/dashboard/settings");
    }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <p style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--ink-heading)" }}>{label}</p>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 2 }}>{hint}</p>
      </div>
      <label style={{ position: "relative", display: "inline-block", width: 48, height: 28, flexShrink: 0 }}>
        <input name={field} type="checkbox" defaultChecked={defaultValue} style={{ opacity: 0, width: 0, height: 0 }} />
        <span style={{ position: "absolute", cursor: "pointer", inset: 0, background: defaultValue ? "var(--green)" : "var(--border)", borderRadius: 28, transition: "0.2s" }} />
        <span style={{ position: "absolute", height: 22, width: 22, left: defaultValue ? 24 : 3, bottom: 3, background: "#fff", borderRadius: "50%", transition: "0.2s" }} />
      </label>
    </form>
  );
}

function ScheduleForm({ s, workspaceId }: { s: any; workspaceId: string }) {
  const DAYS = [
    { key: "1", label: "Пн" }, { key: "2", label: "Вт" }, { key: "3", label: "Ср" },
    { key: "4", label: "Чт" }, { key: "5", label: "Пт" }, { key: "6", label: "Сб" }, { key: "0", label: "Вс" },
  ];
  const currentDays = (s.workDays || "1,2,3,4,5").split(",");

  return (
    <form action={async (fd: FormData) => {
      "use server";
      const days = DAYS.filter(d => fd.get(`day_${d.key}`) === "on").map(d => d.key).join(",") || "1,2,3,4,5";
      const start = fd.get("workHoursStart") as string || "09:00";
      const end = fd.get("workHoursEnd") as string || "21:00";
      await db.settings.update({ where: { workspaceId }, data: { workDays: days, workHoursStart: start, workHoursEnd: end } });
      revalidatePath("/dashboard/settings");
    }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Дни недели */}
      <div>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 8 }}>Дни работы</p>
        <div style={{ display: "flex", gap: 6 }}>
          {DAYS.map(d => (
            <label key={d.key} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: currentDays.includes(d.key) ? "var(--accent-soft)" : "var(--bg-root)", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600, color: currentDays.includes(d.key) ? "var(--accent)" : "var(--ink-muted" }}>
              <input name={`day_${d.key}`} type="checkbox" defaultChecked={currentDays.includes(d.key)} style={{ display: "none" }} />
              {d.label}
            </label>
          ))}
        </div>
      </div>
      {/* Часы */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
        <div>
          <label style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 4 }}>С</label>
          <input name="workHoursStart" type="time" defaultValue={s.workHoursStart || "09:00"} style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-root)", color: "var(--ink-body)", fontSize: "var(--text-sm)", outline: "none" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 4 }}>До</label>
          <input name="workHoursEnd" type="time" defaultValue={s.workHoursEnd || "21:00"} style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-root)", color: "var(--ink-body)", fontSize: "var(--text-sm)", outline: "none" }} />
        </div>
        <SaveBtn />
      </div>
    </form>
  );
}

function SaveBtn() {
  return <button type="submit" style={{ padding: "10px 18px", borderRadius: "var(--radius-sm)", border: "none", background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: "var(--text-sm)", cursor: "pointer", whiteSpace: "nowrap" }}>Сохранить</button>;
}
