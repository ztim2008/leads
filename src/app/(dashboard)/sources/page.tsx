// Страница источников заявок — подключение площадок
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
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
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
                <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                  <span>
                    Проверен:{" "}
                    {existing.lastCheckAt
                      ? new Date(existing.lastCheckAt).toLocaleString("ru")
                      : "Никогда"}
                  </span>
                </div>
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
                      className={`rounded-lg px-4 py-2 text-sm font-medium ${
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
                        },
                      });
                      revalidatePath("/dashboard/sources");
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
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

      {/* Плашка о плагинной архитектуре */}
      <div className="mt-8 rounded-xl bg-indigo-50 p-6 ring-1 ring-indigo-200">
        <p className="font-semibold text-indigo-900">🔌 Плагинная архитектура</p>
        <p className="mt-2 text-sm text-indigo-700">
          Каждый источник — это отдельный коннектор. Новые площадки
          добавляются как модули без изменения ядра системы. В планах:
          Telegram-каналы, VK Услуги, HH.ru, Freelancehunt.
        </p>
      </div>
    </div>
  );
}
