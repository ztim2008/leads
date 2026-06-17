// Страница настроек
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

  const settings = workspace.settings;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
      <p className="mt-1 text-gray-500">
        Фильтры, ключевые слова и интеграции
      </p>

      <div className="mt-8 space-y-6">
        {/* Ключевые слова */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="font-semibold text-gray-900">🎯 Ключевые слова</h2>
          <p className="mt-1 text-sm text-gray-500">
            Система будет показывать заявки, содержащие эти слова. Через запятую.
          </p>
          <form
            action={async (formData: FormData) => {
              "use server";
              const keywords = formData.get("keywords") as string;
              await db.settings.upsert({
                where: { workspaceId: workspace.id },
                create: { workspaceId: workspace.id, keywords },
                update: { keywords },
              });
              revalidatePath("/dashboard/settings");
            }}
            className="mt-4 flex gap-3"
          >
            <input
              name="keywords"
              defaultValue={settings?.keywords || ""}
              placeholder="сайт, лендинг, nextjs, react, seo, telegram, ai"
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Сохранить
            </button>
          </form>
        </div>

        {/* Минус-слова */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="font-semibold text-gray-900">🚫 Минус-слова</h2>
          <p className="mt-1 text-sm text-gray-500">
            Заявки с этими словами будут скрыты.
          </p>
          <form
            action={async (formData: FormData) => {
              "use server";
              const minusKeywords = formData.get("minusKeywords") as string;
              await db.settings.upsert({
                where: { workspaceId: workspace.id },
                create: { workspaceId: workspace.id, minusKeywords },
                update: { minusKeywords },
              });
              revalidatePath("/dashboard/settings");
            }}
            className="mt-4 flex gap-3"
          >
            <input
              name="minusKeywords"
              defaultValue={settings?.minusKeywords || ""}
              placeholder="wordpress, tilda, студент, курсовая"
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Сохранить
            </button>
          </form>
        </div>

        {/* Бюджет */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="font-semibold text-gray-900">💰 Диапазон бюджета</h2>
          <form
            action={async (formData: FormData) => {
              "use server";
              const budgetMin = parseInt(formData.get("budgetMin") as string) || 30000;
              const budgetMax = parseInt(formData.get("budgetMax") as string) || 500000;
              await db.settings.upsert({
                where: { workspaceId: workspace.id },
                create: { workspaceId: workspace.id, budgetMin, budgetMax },
                update: { budgetMin, budgetMax },
              });
              revalidatePath("/dashboard/settings");
            }}
            className="mt-4 flex gap-4"
          >
            <div>
              <label className="text-sm text-gray-500">От (₽)</label>
              <input
                name="budgetMin"
                type="number"
                defaultValue={settings?.budgetMin || 30000}
                className="mt-1 block w-40 rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-500">До (₽)</label>
              <input
                name="budgetMax"
                type="number"
                defaultValue={settings?.budgetMax || 500000}
                className="mt-1 block w-40 rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Сохранить
              </button>
            </div>
          </form>
        </div>

        {/* Telegram */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="font-semibold text-gray-900">📱 Telegram-уведомления</h2>
          <p className="mt-1 text-sm text-gray-500">
            Chat ID вашего аккаунта для получения уведомлений о новых заявках.
          </p>
          <form
            action={async (formData: FormData) => {
              "use server";
              const telegramChatId = formData.get("telegramChatId") as string;
              await db.settings.upsert({
                where: { workspaceId: workspace.id },
                create: { workspaceId: workspace.id, telegramChatId },
                update: { telegramChatId },
              });
              revalidatePath("/dashboard/settings");
            }}
            className="mt-4 flex gap-3"
          >
            <input
              name="telegramChatId"
              defaultValue={settings?.telegramChatId || ""}
              placeholder="123456789"
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Сохранить
            </button>
          </form>
        </div>

        {/* OpenRouter ключ */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="font-semibold text-gray-900">🤖 OpenRouter API ключ</h2>
          <p className="mt-1 text-sm text-gray-500">
            Ключ для AI-анализа заявок. Получить на{" "}
            <a href="https://openrouter.ai/keys" target="_blank" className="text-indigo-600 underline">
              openrouter.ai/keys
            </a>
          </p>
          <form
            action={async (formData: FormData) => {
              "use server";
              const openrouterKey = formData.get("openrouterKey") as string;
              await db.settings.upsert({
                where: { workspaceId: workspace.id },
                create: { workspaceId: workspace.id, openrouterKey },
                update: { openrouterKey },
              });
              revalidatePath("/dashboard/settings");
            }}
            className="mt-4 flex gap-3"
          >
            <input
              name="openrouterKey"
              defaultValue={settings?.openrouterKey || ""}
              type="password"
              placeholder="sk-or-v1-..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Сохранить
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
