// Страница настроек — ключевые слова, бюджет, Telegram, OpenRouter
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
    include: { settings: true },
  });
  if (!workspace) return null;

  const s = workspace.settings;

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 4 }}>Настройки</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginBottom: 32 }}>
        Фильтры, ключевые слова и интеграции
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        {/* Ключевые слова */}
        <SettingsRow title="🎯 Ключевые слова" hint="Система показывает заявки с этими словами. Через запятую.">
          <SettingsForm
            field="keywords"
            defaultValue={s?.keywords || ""}
            placeholder="сайт, лендинг, инфографика, nextjs, react"
            workspaceId={workspace.id}
          />
        </SettingsRow>

        {/* Минус-слова */}
        <SettingsRow title="🚫 Минус-слова" hint="Заявки с этими словами будут скрыты.">
          <SettingsForm
            field="minusKeywords"
            defaultValue={s?.minusKeywords || ""}
            placeholder="wordpress, tilda, студент, курсовая"
            workspaceId={workspace.id}
          />
        </SettingsRow>

        {/* Бюджет */}
        <SettingsRow title="💰 Диапазон бюджета" hint="Отсеивать заявки вне этого диапазона.">
          <form
            action={async (formData: FormData) => {
              "use server";
              const min = parseInt(formData.get("budgetMin") as string) || 3000;
              const max = parseInt(formData.get("budgetMax") as string) || 500000;
              await db.settings.upsert({
                where: { workspaceId: workspace.id },
                create: { workspaceId: workspace.id, budgetMin: min, budgetMax: max },
                update: { budgetMin: min, budgetMax: max },
              });
              revalidatePath("/dashboard/settings");
            }}
            style={{ display: "flex", gap: 12, alignItems: "flex-end" }}
          >
            <Field label="От (₽)" name="budgetMin" defaultValue={s?.budgetMin || 3000} type="number" />
            <Field label="До (₽)" name="budgetMax" defaultValue={s?.budgetMax || 500000} type="number" />
            <SaveBtn />
          </form>
        </SettingsRow>

        {/* Telegram Chat ID */}
        <SettingsRow title="📱 Telegram Chat ID" hint="Ваш ID в Telegram. Получить у @getmyid_bot.">
          <SettingsForm
            field="telegramChatId"
            defaultValue={s?.telegramChatId || ""}
            placeholder="778784292"
            workspaceId={workspace.id}
          />
        </SettingsRow>

        {/* Telegram Bot Token */}
        <SettingsRow title="🤖 Telegram Bot Token" hint="Токен от @BotFather. Создайте бота командой /newbot." last>
          <SettingsForm
            field="telegramToken"
            defaultValue={s?.telegramToken || ""}
            placeholder="123456:ABC-DEF1234ghikl"
            workspaceId={workspace.id}
          />
        </SettingsRow>

        {/* OpenRouter */}
        <SettingsRow title="🤖 OpenRouter API ключ" hint="Для AI-анализа заявок. Получить на openrouter.ai/keys." last>
          <SettingsForm
            field="openrouterKey"
            defaultValue={s?.openrouterKey || ""}
            placeholder="sk-or-v1-..."
            workspaceId={workspace.id}
          />
        </SettingsRow>
      </div>
    </div>
  );
}

// Вспомогательные компоненты
function SettingsRow({ title, hint, children, last }: { title: string; hint: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      padding: "20px 24px", background: "var(--bg-surface)",
      borderBottom: last ? "none" : "1px solid var(--border)",
    }}>
      <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 650, marginBottom: 4 }}>{title}</h3>
      <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 14 }}>{hint}</p>
      {children}
    </div>
  );
}

function SettingsForm({ field, defaultValue, placeholder, workspaceId }: {
  field: string; defaultValue: string; placeholder: string; workspaceId: string;
}) {
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        const value = formData.get(field) as string;
        await db.settings.upsert({
          where: { workspaceId },
          create: { workspaceId, [field]: value },
          update: { [field]: value },
        });
        revalidatePath("/dashboard/settings");
      }}
      style={{ display: "flex", gap: 10 }}
    >
      <input
        name={field}
        defaultValue={defaultValue}
        placeholder={placeholder}
        style={{
          flex: 1, padding: "10px 14px", borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)", background: "var(--bg-root)",
          color: "var(--ink-body)", fontSize: "var(--text-sm)", outline: "none",
        }}
      />
      <SaveBtn />
    </form>
  );
}

function Field({ label, name, defaultValue, type = "text" }: {
  label: string; name: string; defaultValue: any; type?: string;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 4 }}>
        {label}
      </label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        style={{
          width: 140, padding: "10px 14px", borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)", background: "var(--bg-root)",
          color: "var(--ink-body)", fontSize: "var(--text-sm)", outline: "none",
        }}
      />
    </div>
  );
}

function SaveBtn() {
  return (
    <button type="submit" style={{
      padding: "10px 18px", borderRadius: "var(--radius-sm)",
      border: "none", background: "var(--accent)", color: "#fff",
      fontWeight: 600, fontSize: "var(--text-sm)", cursor: "pointer",
      whiteSpace: "nowrap",
    }}>
      Сохранить
    </button>
  );
}
