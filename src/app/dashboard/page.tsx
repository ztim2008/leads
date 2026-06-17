// Панель управления — обзор
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  // Получаем или создаём рабочее пространство
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

  // Создаём настройки если нет
  const settings = await db.settings.findUnique({
    where: { workspaceId: workspace.id },
  });
  if (!settings) {
    await db.settings.create({
      data: { workspaceId: workspace.id },
    });
  }

  // Получаем связанные данные отдельными запросами
  const [totalLeads, activeSources, todayLeads, recentLeads] = await Promise.all([
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
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const stats = [
    { label: "Всего заявок", value: totalLeads, icon: "📋" },
    { label: "Сегодня", value: todayLeads, icon: "🆕" },
    { label: "Активных источников", value: activeSources, icon: "🔌" },
    { label: "Оценка системы", value: "Активна", icon: "✅" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Обзор</h1>
          <p className="mt-1 text-gray-500">
            {workspace.name} — сводка по заявкам
          </p>
        </div>
      </div>

      {/* Статистика */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200"
          >
            <div className="text-2xl">{s.icon}</div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{s.value}</p>
            <p className="mt-1 text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Последние заявки */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Последние заявки</h2>
          <Link
            href="/dashboard/leads"
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            Все заявки →
          </Link>
        </div>
        <div className="mt-4 rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
          {recentLeads.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="text-4xl mb-4">📭</p>
              <p className="text-lg font-medium">Заявок пока нет</p>
              <p className="mt-1">
                Подключите источник заявок в разделе «Источники»
              </p>
              <Link
                href="/dashboard/sources"
                className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500"
              >
                Подключить источник
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-sm text-gray-500">
                  <th className="px-6 py-3 font-medium">Заявка</th>
                  <th className="px-6 py-3 font-medium">Источник</th>
                  <th className="px-6 py-3 font-medium">Бюджет</th>
                  <th className="px-6 py-3 font-medium">Рейтинг</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{lead.title || "Без названия"}</p>
                      <p className="text-sm text-gray-500 line-clamp-1">{lead.description}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {lead.source.name}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {lead.budgetMin ? `${String(lead.budgetMin)}${lead.budgetMax ? `–${String(lead.budgetMax)}` : ""} ₽` : "—"}
                    </td>
                    <td className="px-6 py-4">
                      {lead.analyses[0]?.score != null ? (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            lead.analyses[0].score >= 85
                              ? "bg-green-100 text-green-800"
                              : lead.analyses[0].score >= 70
                                ? "bg-blue-100 text-blue-800"
                                : lead.analyses[0].score >= 40
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                          }`}
                        >
                          {lead.analyses[0].score}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
