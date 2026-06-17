// Страница заявок — лента с фильтрами
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import Link from "next/link";

const STATUSES = ["Все", "Новая", "Интересная", "Откликнулся", "Созвон", "Переговоры", "Выиграл", "Проиграл"];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
  });
  if (!workspace) return null;

  const { status } = await searchParams;
  const statusFilter = status && status !== "Все" ? status : undefined;

  const leads = await db.lead.findMany({
    where: {
      workspaceId: workspace.id,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      source: { select: { platform: true, name: true, color: true } },
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const statusCounts = await Promise.all(
    STATUSES.filter(s => s !== "Все").map(async (s) => ({
      status: s,
      count: await db.lead.count({
        where: { workspaceId: workspace.id, status: s },
      }),
    }))
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Заявки</h1>
      <p className="mt-1 text-gray-500">Лента заявок с AI-оценкой</p>

      {/* Фильтры по статусу */}
      <div className="mt-6 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={s === "Все" ? "/dashboard/leads" : `/dashboard/leads?status=${s}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              (s === "Все" && !statusFilter) || s === statusFilter
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50"
            }`}
          >
            {s}
            {s !== "Все" && (
              <span className="ml-1 opacity-70">
                {statusCounts.find(c => c.status === s)?.count || 0}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Список заявок */}
      <div className="mt-6 space-y-4">
        {leads.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center ring-1 ring-gray-200">
            <p className="text-4xl mb-4">📭</p>
            <p className="text-lg font-medium text-gray-900">Заявок нет</p>
            <p className="mt-1 text-gray-500">
              Подключите источники и дождитесь первого сбора данных
            </p>
          </div>
        ) : (
          leads.map((lead) => {
            const analysis = lead.analyses[0];
            return (
              <div
                key={lead.id}
                className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: lead.source.color || "#6366f1" }}
                      />
                      <span className="text-xs font-medium text-gray-500 uppercase">
                        {lead.source.platform}
                      </span>
                      {analysis?.score != null && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            analysis.score >= 85
                              ? "bg-green-100 text-green-800"
                              : analysis.score >= 70
                                ? "bg-blue-100 text-blue-800"
                                : analysis.score >= 40
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                          }`}
                        >
                          {analysis.score}/100
                        </span>
                      )}
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {lead.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900">
                      <a href={lead.url || "#"} target="_blank" rel="noopener" className="hover:text-indigo-600">
                        {lead.title || "Без названия"}
                      </a>
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                      {lead.description}
                    </p>
                    {analysis?.reasoning && (
                      <p className="mt-2 text-sm text-gray-600 italic">
                        💡 {analysis.reasoning}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-500">
                      {lead.budgetMin && (
                        <span>💰 {String(lead.budgetMin)}{lead.budgetMax ? `–${String(lead.budgetMax)}` : ""} ₽</span>
                      )}
                      {lead.city && <span>📍 {lead.city}</span>}
                      {lead.author && <span>👤 {lead.author}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <select
                      defaultValue={lead.status}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    >
                      {STATUSES.filter(s => s !== "Все").map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
