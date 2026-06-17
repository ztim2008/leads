// Страница заявок — карточки, фильтры, цена, удаление
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import {
  Inbox, Trash2, CheckSquare, Square, ExternalLink,
  Bot, User, Copy, MessageSquare,
} from "lucide-react";
import DeleteButton from "./delete-button";

const STATUSES = ["Все", "Новая", "Интересная", "Откликнулся", "Созвон", "Переговоры", "Выиграл", "Проиграл"];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string; filter?: string }> }) {
  const session = await auth();
  if (!session?.user) return null;

  const workspace = await db.workspace.findFirst({ where: { userId: session.user.id } });
  if (!workspace) return null;

  const { status, filter } = await searchParams;
  const statusFilter = status && status !== "Все" ? status : undefined;

  // Строим where в зависимости от фильтра
  const where: any = { workspaceId: workspace.id };
  if (statusFilter) where.status = statusFilter;

  // Быстрые фильтры
  if (filter === "high") where.score = { gte: 70 };
  if (filter === "budget") where.budgetMin = { gte: 50000 };
  if (filter === "human") {
    where.analyses = { some: { botProbability: { lte: 30 } } };
  }
  if (filter === "responses") {
    where.responses = { some: {} };
  }

  const leads = await db.lead.findMany({
    where,
    include: {
      source: { select: { platform: true, name: true, color: true } },
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
      responses: { take: 4 },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Счётчики статусов
  const statusCounts = await Promise.all(
    STATUSES.filter(s => s !== "Все").map(async (s) => ({
      status: s,
      count: await db.lead.count({ where: { workspaceId: workspace.id, status: s } }),
    }))
  );

  // Счётчики быстрых фильтров
  const [highCount, budgetCount, humanCount, respCount] = await Promise.all([
    db.lead.count({ where: { workspaceId: workspace.id, score: { gte: 70 } } }),
    db.lead.count({ where: { workspaceId: workspace.id, budgetMin: { gte: 50000 } } }),
    db.leadAnalysis.count({ where: { lead: { workspaceId: workspace.id }, botProbability: { lte: 30 } } }),
    db.lead.count({ where: { workspaceId: workspace.id, responses: { some: {} } } }),
  ]);

  const totalCount = await db.lead.count({ where: { workspaceId: workspace.id } });

  function budgetColor(min?: any): string {
    if (!min) return "var(--ink-muted)";
    if (min >= 150000) return "#7c3aed";
    if (min >= 50000) return "var(--green)";
    if (min >= 10000) return "var(--blue)";
    return "var(--ink-muted)";
  }

  function formatBudget(min?: any, max?: any): string {
    if (min == null) return "—"; min = Number(min);
    if (Number(min) >= 1000) return `${(min / 1000).toFixed(0)}K ₽`;
    return `${min} ₽`;
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 4 }}>Заявки</h1>
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>
          {totalCount} заявок · {highCount} приоритетных · {humanCount} от живых людей
        </p>
      </div>

      {/* ─── Быстрые фильтры ─────────────────────────────── */}
      <div style={{
        display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20,
      }}>
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
              display: "flex", alignItems: "center", gap: 8,
              textDecoration: "none", transition: "all 0.1s",
            }}
          >
            {f.label}
            <span style={{ opacity: 0.5, fontSize: "var(--text-xs)" }}>{f.count}</span>
          </Link>
        ))}
      </div>

      {/* ─── Список заявок ───────────────────────────────── */}
      <div style={{
        border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
        overflow: "hidden", background: "var(--bg-surface)",
      }}>
        {leads.length === 0 ? (
          <div style={{ padding: "64px 24px", textAlign: "center" }}>
            <Inbox size={48} style={{ color: "var(--ink-muted)", opacity: 0.3, marginBottom: 16 }} />
            <p style={{ fontWeight: 600, color: "var(--ink-heading)", fontSize: "var(--text-lg)" }}>
              Заявок нет
            </p>
            <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginTop: 4 }}>
              {totalCount === 0 ? "Подключите источник заявок" : "Нет заявок по выбранному фильтру"}
            </p>
          </div>
        ) : (
          leads.map((lead) => {
            const a = lead.analyses[0];
            const bColor = budgetColor(lead.budgetMin ? Number(lead.budgetMin) : null);

            return (
              <div
                key={lead.id}
                style={{
                  display: "grid", gridTemplateColumns: "130px 1fr auto",
                  gap: 0, borderBottom: "1px solid var(--border-light)",
                  padding: "16px 20px", alignItems: "center",
                }}
              >
                {/* ─── Цена ──────────────────────────────── */}
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start",
                }}>
                  <div style={{
                    background: bColor + "14",
                    border: "1.5px solid " + bColor,
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 14px",
                    textAlign: "center", minWidth: 90,
                  }}>
                    <p style={{
                      fontSize: "var(--text-xl)", fontWeight: 800, color: bColor,
                      lineHeight: 1.1, marginBottom: 2,
                    }}>
                      {formatBudget(lead.budgetMin ? Number(lead.budgetMin) : null, lead.budgetMax)}
                    </p>
                    {lead.budgetMax && lead.budgetMin && lead.budgetMax !== lead.budgetMin && (
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                        до {formatBudget(lead.budgetMax ? Number(lead.budgetMax) : null)}
                      </p>
                    )}
                  </div>
                </div>

                {/* ─── Инфо ──────────────────────────────── */}
                <div style={{ paddingLeft: 20, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: (lead.source.color as string) || "var(--accent)",
                    }} />
                    <a
                      href={lead.url || "#"}
                      target="_blank"
                      rel="noopener"
                      style={{
                        fontWeight: 650, color: "var(--ink-heading)",
                        fontSize: "var(--text-base)", textDecoration: "none",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}
                    >
                      {lead.title || "Без названия"}
                    </a>
                    <ExternalLink size={12} style={{ color: "var(--ink-muted)", flexShrink: 0 }} />
                  </div>

                  <p style={{
                    fontSize: "var(--text-xs)", color: "var(--ink-muted)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    maxWidth: "100%", marginBottom: 8,
                  }}>
                    {lead.description?.slice(0, 150)}
                  </p>

                  {/* AI-метки */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {a?.score != null && (
                      <span style={{
                        padding: "3px 10px", borderRadius: 100, fontSize: "var(--text-xs)", fontWeight: 700,
                        background: a.score >= 85 ? "var(--green-soft)" : a.score >= 70 ? "var(--blue-soft)" : a.score >= 40 ? "var(--amber-soft)" : "var(--red-soft)",
                        color: a.score >= 85 ? "var(--green)" : a.score >= 70 ? "var(--blue)" : a.score >= 40 ? "var(--amber)" : "var(--red)",
                      }}>
                        {a.score}/100
                      </span>
                    )}

                    {a?.botProbability != null && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "3px 10px", borderRadius: 100,
                        fontSize: "var(--text-xs)", fontWeight: 600,
                        background: a.botProbability <= 30 ? "var(--green-soft)" : a.botProbability <= 60 ? "var(--amber-soft)" : "var(--red-soft)",
                        color: a.botProbability <= 30 ? "var(--green)" : a.botProbability <= 60 ? "var(--amber)" : "var(--red)",
                      }}>
                        {a.botProbability <= 30 ? <User size={11} /> : <Bot size={11} />}
                        {a.botProbability <= 30 ? "Живой" : a.botProbability <= 60 ? "Подозрительно" : "Робот"}
                      </span>
                    )}

                    {lead.responses.length > 0 && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "3px 10px", borderRadius: 100,
                        fontSize: "var(--text-xs)", fontWeight: 600,
                        background: "var(--accent-soft)", color: "var(--accent)",
                      }}>
                        <MessageSquare size={11} />
                        {lead.responses.length} отклика
                      </span>
                    )}

                    {a?.recommendation && (
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                        {a.recommendation}
                      </span>
                    )}
                  </div>
                </div>

                {/* ─── Действия ───────────────────────────── */}
                <div style={{ display: "flex", gap: 6, paddingLeft: 16 }}>
                  <DeleteButton leadId={lead.id} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
