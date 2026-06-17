// Панель управления — обзор
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  // Получаем или создаём пространство
  let workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
  });
  if (!workspace) {
    workspace = await db.workspace.create({
      data: {
        userId: session.user.id,
        name: "Моё пространство",
        slug: `ws-${session.user.id.slice(0, 8)}`,
      },
    });
  }

  // Настройки
  const settings = await db.settings.findUnique({
    where: { workspaceId: workspace.id },
  });
  if (!settings) {
    await db.settings.create({ data: { workspaceId: workspace.id } });
  }

  // Статистика
  const [totalLeads, activeSources, todayLeads, recentLeads, sources] =
    await Promise.all([
      db.lead.count({ where: { workspaceId: workspace.id } }),
      db.source.count({ where: { workspaceId: workspace.id, enabled: true } }),
      db.lead.count({
        where: {
          workspaceId: workspace.id,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      db.lead.findMany({
        where: { workspaceId: workspace.id },
        include: {
          source: { select: { platform: true, name: true, color: true } },
          analyses: { orderBy: { createdAt: "desc" }, take: 1 },
          responses: { take: 1 },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.source.findMany({
        where: { workspaceId: workspace.id },
        select: { id: true, platform: true, name: true, enabled: true, lastCheckAt: true, color: true },
      }),
    ]);

  // Считаем оценённые заявки
  const analyzedCount = await db.leadAnalysis.count({
    where: { lead: { workspaceId: workspace.id } },
  });

  const stats = [
    { label: "Всего заявок", value: totalLeads, icon: "📋" },
    { label: "Сегодня", value: todayLeads, icon: "🆕" },
    { label: "С AI-оценкой", value: analyzedCount, icon: "🧠" },
    { label: "Источников", value: activeSources, icon: "🔌" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Обзор</h1>
          <p className="mt-1 text-gray-500">{workspace.name} — сводка</p>
        </div>
      </div>

      {/* Статистика */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <div className="text-2xl">{s.icon}</div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{s.value}</p>
            <p className="mt-1 text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Статус источников */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {sources.map((source) => (
          <div key={source.id} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: (source.color as string) || "#6366f1" }}
                />
                <span className="font-medium text-gray-900">{source.name}</span>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  source.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                }`}
              >
                {source.enabled ? "Активен" : "На паузе"}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
              <span>
                Проверен:{" "}
                {source.lastCheckAt
                  ? new Date(source.lastCheckAt).toLocaleString("ru", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </span>
              <span>Каждые 5 мин</span>
            </div>
          </div>
        ))}
        {sources.length === 0 && (
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 col-span-2 text-center">
            <p className="text-gray-500">Нет подключённых источников</p>
            <Link href="/dashboard/sources" className="mt-2 inline-block text-indigo-600 hover:underline text-sm">
              Подключить источник →
            </Link>
          </div>
        )}
      </div>

      {/* Последние заявки */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Последние заявки</h2>
          <Link href="/dashboard/leads" className="text-sm text-indigo-600 hover:text-indigo-500">
            Все заявки →
          </Link>
        </div>
        <div className="mt-4 rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
          {recentLeads.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="text-4xl mb-4">📭</p>
              <p className="text-lg font-medium">Заявок пока нет</p>
              <Link href="/dashboard/sources" className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500">
                Подключить источник
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-sm text-gray-500">
                  <th className="px-6 py-3 font-medium">Заявка</th>
                  <th className="px-6 py-3 font-medium">Бюджет</th>
                  <th className="px-6 py-3 font-medium">AI</th>
                  <th className="px-6 py-3 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentLeads.map((lead) => {
                  const analysis = lead.analyses[0];
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: (lead.source.color as string) || "#6366f1" }}
                          />
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{lead.title || "Без названия"}</p>
                            <p className="text-xs text-gray-500 line-clamp-1">{lead.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm">
                        {lead.budgetMin ? `${String(lead.budgetMin)} ₽` : "—"}
                      </td>
                      <td className="px-6 py-3">
                        {analysis?.score != null ? (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                              analysis.score >= 85
                                ? "bg-green-100 text-green-800"
                                : analysis.score >= 70
                                  ? "bg-blue-100 text-blue-800"
                                  : analysis.score >= 40
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                            }`}
                          >
                            {analysis.score}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm">
                        {lead.responses.length > 0 ? (
                          <span className="text-green-600 text-xs">📝 отклики</span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
