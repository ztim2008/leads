// Страница источников заявок — подключение и настройка площадок
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import { listConnectors } from "@/lib/connectors/types";
import { revalidatePath } from "next/cache";

// Импорт коннекторов для регистрации
import "@/lib/connectors/profi";

const PLATFORM_COLORS: Record<string, string> = {
  profi: "#22c55e",
  avito: "#3b82f6",
  fl: "#8b5cf6",
  kwork: "#f97316",
};

export default async function SourcesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
    include: { sources: true },
  });
  if (!workspace) return null;

  const availableConnectors = listConnectors();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Источники заявок</h1>
      <p className="mt-1 text-gray-500">
        Подключите площадки для автоматического сбора заказов
      </p>

      {/* Доступные коннекторы */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {availableConnectors.map((connector) => {
          const existing = workspace.sources.find(
            (s) => s.platform === connector.platform
          );
          const color = PLATFORM_COLORS[connector.platform] || "#6366f1";

          return (
            <div
              key={connector.platform}
              className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white text-lg font-bold"
                  style={{ backgroundColor: color }}
                >
                  {connector.platform[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{connector.name}</h3>
                  <p className="text-sm text-gray-500">
                    {existing
                      ? existing.enabled
                        ? "✅ Подключен"
                        : "⏸ Приостановлен"
                      : "Не подключен"}
                  </p>
                </div>
              </div>

              {existing && (
                <>
                  <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                    <span>
                      Проверен:{" "}
                      {existing.lastCheckAt
                        ? new Date(existing.lastCheckAt).toLocaleString("ru")
                        : "Никогда"}
                    </span>
                  </div>

                  {/* Поле кук для Profi */}
                  {connector.platform === "profi" && (
                    <form
                      action={async (formData: FormData) => {
                        "use server";
                        const cookies = formData.get("cookies") as string;
                        const currentSource = await db.source.findUnique({
                          where: { id: existing.id },
                        });
                        const currentConfig = (currentSource?.config as Record<string, unknown>) || {};
                        await db.source.update({
                          where: { id: existing.id },
                          data: {
                            config: { ...currentConfig, cookies: cookies || "" },
                          },
                        });
                        revalidatePath("/dashboard/sources");
                      }}
                      className="mt-4"
                    >
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        🔑 Куки сессии Profi.ru
                      </label>
                      <p className="text-xs text-gray-400 mb-2">
                        Как получить: откройте profi.ru → F12 → Application → Cookies →
                        profi.ru → скопируйте все строки (Name=Value) и вставьте сюда
                      </p>
                      <textarea
                        name="cookies"
                        rows={3}
                        defaultValue={
                          ((existing.config as Record<string, unknown>)?.cookies as string) || ""
                        }
                        placeholder="session_id=abc123...&#10;auth_token=xyz789..."
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono bg-gray-50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                      />
                      <button
                        type="submit"
                        className="mt-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        💾 Сохранить куки
                      </button>
                    </form>
                  )}
                </>
              )}

              <div className="mt-4 flex gap-2">
                {existing ? (
                  <form
                    action={async () => {
                      "use server";
                      await db.source.update({
                        where: { id: existing.id },
                        data: { enabled: !existing.enabled },
                      });
                      revalidatePath("/dashboard/sources");
                    }}
                  >
                    <button
                      type="submit"
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        existing.enabled
                          ? "bg-red-50 text-red-700 hover:bg-red-100"
                          : "bg-green-50 text-green-700 hover:bg-green-100"
                      }`}
                    >
                      {existing.enabled ? "Отключить" : "Включить"}
                    </button>
                  </form>
                ) : (
                  <form
                    action={async () => {
                      "use server";
                      await db.source.create({
                        data: {
                          workspaceId: workspace.id,
                          platform: connector.platform,
                          name: connector.name,
                          color: color,
                          enabled: true,
                          config: {},
                        },
                      });
                      revalidatePath("/dashboard/sources");
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
                    >
                      Подключить
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Инструкция по кукам */}
      <div className="mt-8 rounded-xl bg-amber-50 p-6 ring-1 ring-amber-200">
        <p className="font-semibold text-amber-900">📖 Как получить куки Profi.ru</p>
        <ol className="mt-3 space-y-2 text-sm text-amber-800 list-decimal list-inside">
          <li>Откройте <b>profi.ru</b> и войдите как обычно (телефон + SMS)</li>
          <li>Нажмите <b>F12</b> → вкладка <b>Application</b> (или «Приложение»)</li>
          <li>Слева: <b>Cookies</b> → <b>profi.ru</b></li>
          <li>Скопируйте ВСЕ строки из колонок <b>Name</b> и <b>Value</b></li>
          <li>Вставьте в поле «Куки сессии» выше и нажмите «Сохранить»</li>
          <li>Куки живут 1–2 недели, потом нужно обновить</li>
        </ol>
      </div>

      {/* Плагинная архитектура */}
      <div className="mt-8 rounded-xl bg-indigo-50 p-6 ring-1 ring-indigo-200">
        <p className="font-semibold text-indigo-900">🔌 Плагинная архитектура</p>
        <p className="mt-2 text-sm text-indigo-700">
          Каждый источник — отдельный коннектор. Новые площадки добавляются как
          модули без изменения ядра. В планах: Telegram-каналы, VK Услуги, HH.ru,
          Freelancehunt.
        </p>
      </div>
    </div>
  );
}
