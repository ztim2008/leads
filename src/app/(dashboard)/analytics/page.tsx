// Страница аналитики
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
  });
  if (!workspace) return null;

  const [totalLeads, wonLeads, todayLeads] = await Promise.all([
    db.lead.count({ where: { workspaceId: workspace.id } }),
    db.lead.count({ where: { workspaceId: workspace.id, status: "Выиграл" } }),
    db.lead.count({
      where: {
        workspaceId: workspace.id,
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ]);

  const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : "0";

  // По площадкам
  const sources = await db.source.findMany({
    where: { workspaceId: workspace.id },
    include: { _count: { select: { leads: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Аналитика</h1>
      <p className="mt-1 text-gray-500">Статистика и эффективность</p>

      {/* Ключевые метрики */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Всего заявок", value: totalLeads, icon: "📋" },
          { label: "Сегодня", value: todayLeads, icon: "🆕" },
          { label: "Сделок", value: wonLeads, icon: "🏆" },
          { label: "Конверсия", value: `${conversionRate}%`, icon: "📈" },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200"
          >
            <div className="text-2xl">{m.icon}</div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{m.value}</p>
            <p className="mt-1 text-sm text-gray-500">{m.label}</p>
          </div>
        ))}
      </div>

      {/* По площадкам */}
      <div className="mt-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <h2 className="font-semibold text-gray-900">Заявки по площадкам</h2>
        <div className="mt-4 space-y-3">
          {sources.map((source) => (
            <div key={source.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: source.color || "#6366f1" }}
                />
                <span className="text-sm font-medium text-gray-900">
                  {source.name}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-2 w-32 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${totalLeads > 0 ? (source._count.leads / totalLeads) * 100 : 0}%`,
                      backgroundColor: source.color || "#6366f1",
                    }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-900 w-8 text-right">
                  {source._count.leads}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Плашка */}
      <div className="mt-8 rounded-xl bg-gray-50 p-6 ring-1 ring-gray-200 text-center">
        <p className="text-gray-500">
          📊 Подробная аналитика появится после накопления данных по заявкам.
        </p>
      </div>
    </div>
  );
}
