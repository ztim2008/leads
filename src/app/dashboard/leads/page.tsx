// Страница заявок — карточки с разворотом, фильтры, удаление
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import Link from "next/link";
import { Inbox } from "lucide-react";
import LeadDetail from "@/components/leads/lead-detail";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string; filter?: string }> }) {
  const session = await auth();
  if (!session?.user) return null;

  const workspace = await db.workspace.findFirst({ where: { userId: session.user.id } });
  if (!workspace) return null;

  const { status, filter } = await searchParams;

  const where: any = { workspaceId: workspace.id };
  if (status && status !== "Все") where.status = status;
  if (filter === "high") where.score = { gte: 70 };
  if (filter === "budget") where.budgetMin = { gte: 50000 };
  if (filter === "human") where.analyses = { some: { botProbability: { lte: 30 } } };
  if (filter === "responses") where.responses = { some: {} };

  const leads = await db.lead.findMany({
    where,
    include: {
      source: { select: { platform: true, name: true, color: true } },
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
      responses: { take: 4, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const [totalCount, highCount, budgetCount, humanCount, respCount] = await Promise.all([
    db.lead.count({ where: { workspaceId: workspace.id } }),
    db.lead.count({ where: { workspaceId: workspace.id, score: { gte: 70 } } }),
    db.lead.count({ where: { workspaceId: workspace.id, budgetMin: { gte: 50000 } } }),
    db.leadAnalysis.count({ where: { lead: { workspaceId: workspace.id }, botProbability: { lte: 30 } } }),
    db.lead.count({ where: { workspaceId: workspace.id, responses: { some: {} } } }),
  ]);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 4 }}>Заявки</h1>
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>
          {totalCount} заявок · {highCount} приоритетных · {humanCount} от живых людей
        </p>
      </div>

      {/* Быстрые фильтры */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {[
          { key: "", label: "Все", count: totalCount, active: !filter },
          { key: "high", label: "⭐ 70+", count: highCount, active: filter === "high" },
          { key: "budget", label: "💰 50K+", count: budgetCount, active: filter === "budget" },
          { key: "human", label: "🟢 Живой", count: humanCount, active: filter === "human" },
          { key: "responses", label: "📝 Отклики", count: respCount, active: filter === "responses" },
        ].map(f => (
          <Link
            key={f.key}
            href={f.key ? `?filter=${f.key}` : "?"}
            style={{
              padding: "9px 16px", borderRadius: "var(--radius-sm)",
              border: f.active ? "2px solid var(--accent)" : "1px solid var(--border)",
              background: f.active ? "var(--accent-soft)" : "var(--bg-surface)",
              color: f.active ? "var(--accent)" : "var(--ink-body)",
              fontWeight: f.active ? 600 : 500, fontSize: "var(--text-sm)",
              display: "flex", alignItems: "center", gap: 8, textDecoration: "none",
            }}
          >
            {f.label}
            <span style={{ opacity: 0.5, fontSize: "var(--text-xs)" }}>{f.count}</span>
          </Link>
        ))}
      </div>

      {/* Список */}
      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-surface)" }}>
        {leads.length === 0 ? (
          <div style={{ padding: "64px 24px", textAlign: "center" }}>
            <Inbox size={48} style={{ color: "var(--ink-muted)", opacity: 0.3, marginBottom: 16 }} />
            <p style={{ fontWeight: 600, color: "var(--ink-heading)", fontSize: "var(--text-lg)" }}>Заявок нет</p>
            <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginTop: 4 }}>
              {totalCount === 0 ? "Подключите источник заявок" : "Нет заявок по выбранному фильтру"}
            </p>
          </div>
        ) : (
          leads.map((lead) => (
            <LeadDetail key={lead.id} lead={{
              id: lead.id,
              title: lead.title,
              description: lead.description,
              budgetMin: lead.budgetMin,
              budgetMax: lead.budgetMax,
              url: lead.url,
              city: lead.city,
              author: lead.author,
              status: lead.status,
              source: {
                platform: lead.source.platform,
                name: lead.source.name,
                color: lead.source.color as string | null,
              },
              analyses: lead.analyses.map(a => ({
                score: a.score,
                budgetPrediction: a.budgetPrediction,
                difficulty: a.difficulty,
                recommendation: a.recommendation,
                reasoning: a.reasoning,
                botProbability: a.botProbability,
                modelUsed: a.modelUsed,
              })),
              responses: lead.responses.map(r => ({
                id: r.id,
                type: r.type,
                content: r.content,
              })),
            }} />
          ))
        )}
      </div>
    </div>
  );
}
