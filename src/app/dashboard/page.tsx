// Панель управления — обзор
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Inbox, Brain, Plug, TrendingUp, Plus, ExternalLink } from "lucide-react";
import HowCollectorWorks from "@/components/dashboard/how-collector-works";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as { role?: string; impersonatorId?: string };
  if (u.role === "admin" && !u.impersonatorId) {
    redirect("/dashboard/admin/ops");
  }

  let workspace = await db.workspace.findFirst({ where: { userId: session.user.id } });
  if (!workspace) {
    try {
    workspace = await db.workspace.create({
      data: { userId: session.user.id, name: "Моё пространство", slug: `ws-${session.user.id.slice(0, 8)}` },
    });
    } catch (e: any) {
      if (e?.code === 'P2003') {
        console.warn('[dashboard] FK violation for user ' + session.user.id + ' — user missing in DB');
        return null;
      }
      throw e;
    }
  }

  const settings = await db.settings.findUnique({ where: { workspaceId: workspace.id } });
  if (!settings) await db.settings.create({ data: { workspaceId: workspace.id } });

  const [totalLeads, analyzedCount, activeSources, todayLeads, recentLeads, sources] = await Promise.all([
    db.lead.count({ where: { workspaceId: workspace.id } }),
    db.leadAnalysis.count({ where: { lead: { workspaceId: workspace.id } } }),
    db.source.count({ where: { workspaceId: workspace.id, enabled: true } }),
    db.lead.count({ where: { workspaceId: workspace.id, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    db.lead.findMany({
      where: { workspaceId: workspace.id },
      include: {
        source: { select: { platform: true, name: true, color: true } },
        analyses: { orderBy: { createdAt: "desc" }, take: 1 },
        responses: { take: 1 },
      },
      orderBy: { createdAt: "desc" }, take: 10,
    }),
    db.source.findMany({ where: { workspaceId: workspace.id } }),
  ]);

  const profi = sources.find((s) => s.platform === "profi") || sources[0];
  const hbAge = profi?.lastCheckAt ? Date.now() - new Date(profi.lastCheckAt).getTime() : null;
  const collecting = !!profi?.enabled && hbAge != null && hbAge < 20 * 60 * 1000;
  const hasError = !!profi?.lastError && (hbAge == null || hbAge >= 20 * 60 * 1000);
  const lastLeadAt = recentLeads[0]?.createdAt ? new Date(recentLeads[0].createdAt).toISOString() : null;

  const stats = [
    { label: "Всего заявок", value: totalLeads, icon: Inbox, color: "var(--accent)" },
    { label: "С AI-оценкой", value: analyzedCount, icon: Brain, color: "var(--purple)" },
    { label: "Сегодня", value: todayLeads, icon: TrendingUp, color: "var(--green)" },
    { label: "Источников", value: activeSources, icon: Plug, color: "var(--blue)" },
  ];

  return (
    <div>
      {/* Заголовок */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 4 }}>
          Обзор
        </h1>
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>
          {workspace.name}
        </p>
      </div>

      <HowCollectorWorks
        collecting={collecting}
        paused={!profi?.enabled}
        hasError={hasError}
        lastLeadAt={lastLeadAt}
        todayCount={todayLeads}
      />

      {/* Статистика — сетка 0px */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
        overflow: "hidden", marginBottom: 32,
      }}>
        {stats.map((s, i) => (
          <div key={s.label} style={{
            padding: "24px 28px", background: "var(--bg-surface)",
            borderRight: i < 3 ? "1px solid var(--border)" : "none",
            display: "flex", gap: 16, alignItems: "flex-start",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: "var(--radius-sm)",
              background: "var(--accent-soft)", color: s.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <s.icon size={20} strokeWidth={1.75} />
            </div>
            <div>
              <p style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--ink-heading)", lineHeight: 1 }}>
                {s.value}
              </p>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 4 }}>
                {s.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Источники */}
      <div style={{
        border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
        overflow: "hidden", marginBottom: 32,
      }}>
        <div style={{
          padding: "16px 24px", background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h2 style={{ fontSize: "var(--text-base)", fontWeight: 650 }}>
            Источники
          </h2>
          <Link href="/dashboard/sources" style={{
            fontSize: "var(--text-xs)", color: "var(--accent)", fontWeight: 600,
            display: "flex", alignItems: "center", gap: 4,
          }}>
            Настроить <ExternalLink size={12} />
          </Link>
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        }}>
          {sources.map((s) => (
            <div key={s.id} style={{
              padding: "20px 24px", background: "var(--bg-surface)",
              borderRight: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: (s.color as string) || "var(--accent)",
                }} />
                <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
                  {s.name}
                </span>
                <span style={{
                  marginLeft: "auto", fontSize: "var(--text-xs)", fontWeight: 600,
                  padding: "3px 10px", borderRadius: 100,
                  background: s.enabled ? "var(--green-soft)" : "var(--bg-hover)",
                  color: s.enabled ? "var(--green)" : "var(--ink-muted)",
                }}>
                  {s.enabled ? "Активен" : "Пауза"}
                </span>
              </div>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                Проверен: {s.lastCheckAt
                  ? new Date(s.lastCheckAt).toLocaleString("ru", { hour: "2-digit", minute: "2-digit" })
                  : "—"}
                {" · "}Каждые 5 мин
              </p>
            </div>
          ))}
          {sources.length === 0 && (
            <div style={{ padding: "32px 24px", textAlign: "center", gridColumn: "1/-1" }}>
              <p style={{ color: "var(--ink-muted)", marginBottom: 12 }}>
                Нет источников
              </p>
              <Link href="/dashboard/sources" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                color: "var(--accent)", fontWeight: 600, fontSize: "var(--text-sm)",
              }}>
                <Plus size={16} /> Подключить
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Последние заявки */}
      <div style={{
        border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "16px 24px", background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h2 style={{ fontSize: "var(--text-base)", fontWeight: 650 }}>
            Последние заявки
          </h2>
          <Link href="/dashboard/leads" style={{
            fontSize: "var(--text-xs)", color: "var(--accent)", fontWeight: 600,
          }}>
            Все заявки →
          </Link>
        </div>

        {recentLeads.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", background: "var(--bg-surface)" }}>
            <Inbox size={40} style={{ color: "var(--ink-muted)", marginBottom: 16, opacity: 0.4 }} />
            <p style={{ fontWeight: 600, color: "var(--ink-heading)", marginBottom: 4 }}>
              Заявок пока нет
            </p>
            <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>
              Подключите источник и дождитесь первого сбора
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--bg-surface)" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "12px 24px", textAlign: "left", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)" }}>
                  Заявка
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)" }}>
                  Бюджет
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)" }}>
                  AI
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)" }}>
                  Отклики
                </th>
              </tr>
            </thead>
            <tbody>
              {recentLeads.map((lead) => {
                const a = lead.analyses[0];
                return (
                  <tr key={lead.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "14px 24px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                          background: (lead.source.color as string) || "var(--accent)",
                        }} />
                        <div>
                          <p style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--ink-heading)" }}>
                            {lead.title || "Без названия"}
                          </p>
                          <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>
                            {lead.description?.slice(0, 100)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: "var(--text-sm)", fontWeight: 500 }}>
                      {lead.budgetMin ? `${String(lead.budgetMin)} ₽` : "—"}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      {a?.score != null ? (
                        <span style={{
                          display: "inline-flex", padding: "4px 10px", borderRadius: 100,
                          fontSize: "var(--text-xs)", fontWeight: 700,
                          background: a.score >= 85 ? "var(--green-soft)" : a.score >= 70 ? "var(--blue-soft)" : a.score >= 40 ? "var(--amber-soft)" : "var(--red-soft)",
                          color: a.score >= 85 ? "var(--green)" : a.score >= 70 ? "var(--blue)" : a.score >= 40 ? "var(--amber)" : "var(--red)",
                        }}>
                          {a.score}
                        </span>
                      ) : (
                        <span style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      {lead.responses.length > 0 ? (
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--green)", fontWeight: 600 }}>
                          {lead.responses.length} шт.
                        </span>
                      ) : (
                        <span style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}>—</span>
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
  );
}
