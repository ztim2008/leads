import CollectorStatus from "@/components/admin/collector-status";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import Link from "next/link";
import { Shield, Users, CreditCard, Activity, UserPlus, Banknote } from "lucide-react";
import AddPartnerButton from "@/components/admin/add-partner-button";
import ClientLoginButton from "@/components/admin/login-as-button";
import HealthCheckWidget from "@/components/admin/health-check-widget";
      <CollectorStatus />
import PartnersList from "@/components/admin/partners-list";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) return null;
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== "admin") {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <Shield size={48} style={{ color: "var(--ink-muted)", opacity: 0.3, marginBottom: 16 }} />
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 8 }}>Доступ запрещён</h1>
        <p style={{ color: "var(--ink-muted)" }}>Требуется роль администратора</p>
      </div>
    );
  }

  const [totalUsers, totalWorkspaces, totalLeads, totalSources, recentActivity] = await Promise.all([
    db.user.count(), db.workspace.count(), db.lead.count(), db.source.count(),
    db.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const users = await db.user.findMany({
    include: {
      workspaces: {
        include: {
          _count: { select: { leads: true, sources: true } },
          settings: { select: { telegramChatId: true } },
          sources: { select: { enabled: true, config: true, status: true } },
        },
      },
      subscription: true,
    },
    orderBy: { createdAt: "desc" }, take: 50,
  });

  return (
    <div>
      {/* ═══ Табы админки ═══ */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--accent)", borderBottom: "2px solid var(--accent)", padding: "10px 16px", marginBottom: -1 }}>🩺 Мониторинг</span>
        <Link href="/dashboard/admin/billing" style={{ fontWeight: 500, fontSize: "var(--text-sm)", color: "var(--ink-muted)", padding: "10px 16px", textDecoration: "none" }}>💰 Биллинг</Link>
      </div>

      {/* Проверка системы */}
      <HealthCheckWidget />
      <CollectorStatus />

      {/* Быстрые кнопки */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <Link href="/dashboard/admin/billing" style={{ padding: "10px 18px", borderRadius: "var(--radius-sm)", background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent)", fontWeight: 600, fontSize: "var(--text-sm)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
          <Banknote size={16} /> Биллинг и подписки
        </Link>
      </div>

      {/* Статистика */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: 32 }}>
        {[{ label: "Пользователей", value: totalUsers, icon: Users }, { label: "Пространств", value: totalWorkspaces, icon: Activity }, { label: "Заявок всего", value: totalLeads, icon: CreditCard }, { label: "Источников", value: totalSources, icon: Shield }].map((s, i) => { return (
          <div key={s.label} style={{ padding: "20px 24px", background: "var(--bg-surface)", borderRight: i < 3 ? "1px solid var(--border)" : "none", display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 38, height: 38, borderRadius: "var(--radius-sm)", background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}><s.icon size={18} strokeWidth={1.75} /></div>
            <div><p style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--ink-heading)", lineHeight: 1 }}>{s.value}</p><p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 2 }}>{s.label}</p></div>
          </div>
        )})}
      </div>

      {/* Таблица пользователей */}
      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-surface)", marginBottom: 32 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", fontWeight: 650, fontSize: "var(--text-sm)" }}>👥 Пользователи ({users.length})</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--border)" }}><th style={th}>Пользователь</th><th style={th}>Роль</th><th style={th}>Пространств</th><th style={th}>Заявок</th><th style={th}>Источников</th><th style={th}>Telegram</th><th style={th}>Подписка</th><th style={th}>Дата</th><th style={th}></th></tr></thead>
          <tbody>
            {users.map((u) => {
              const ws = u.workspaces[0];
              return (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={td}>
                    <div><p style={{ fontWeight: 650, fontSize: "var(--text-sm)", color: "var(--ink-heading)" }}>{[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}</p><p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{u.email}</p></div>
                  </td>
                  <td style={td}><span style={{ padding: "3px 10px", borderRadius: 100, fontSize: "var(--text-xs)", fontWeight: 600, background: u.role === "admin" ? "#7c3aed20" : "var(--bg-hover)", color: u.role === "admin" ? "#7c3aed" : "var(--ink-muted)" }}>{u.role === "admin" ? "Админ" : "Польз."}</span></td>
                  <td style={td}>{u.workspaces.length}</td>
                  <td style={td}>{ws?._count.leads || 0}</td>
                  <td style={td}>{ws?._count.sources || 0}
                  {ws?.sources?.filter((src: any) => src.enabled).map((src: any, si: number) => {
                    const ad = (src.config as any)?.antiDetect || {};
                    const m = ad.mode || 'light';
                    const map: any = { light:'🛡️-#22c55e', balanced:'⚔️-3b82f6', stealth:'🕵️-8b5cf6' };
                    const [icon, clr] = (map[m] || '🛡️-#22c55e').split('-');
                    return <span key={si} style={{ marginLeft:4, padding:'1px 6px', borderRadius:100, fontSize:'0.55rem', fontWeight:600, background: '#'+clr+'18', color:'#'+clr }}>{icon}</span>;
                  })}</td>
                  <td style={td}>{ws?.settings?.telegramChatId ? "✅" : "—"}</td>
                  <td style={td}><span style={{ padding: "3px 10px", borderRadius: 100, fontSize: "var(--text-xs)", fontWeight: 600, background: u.subscription?.plan === "pro" ? "var(--green-soft)" : "var(--bg-hover)", color: u.subscription?.plan === "pro" ? "var(--green)" : "var(--ink-muted)" }}>{u.subscription?.plan === "pro" ? "Pro" : "Free"}</span></td>
                  <td style={{ ...td, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{new Date(u.createdAt).toLocaleDateString("ru")}</td>
                  <td style={td}><ClientLoginButton email={u.email} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Партнёры */}
      <div style={{ marginBottom: 32, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-surface)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 650, fontSize: "var(--text-sm)", display: "flex", alignItems: "center", gap: 8 }}><UserPlus size={16} /> Партнёры</span>
          <AddPartnerButton />
        </div>
        <PartnersList />
      </div>

      {/* Активность */}
      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-surface)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", fontWeight: 650, fontSize: "var(--text-sm)" }}>📋 Последние события</div>
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {recentActivity.length === 0 ? <p style={{ padding: "20px", color: "var(--ink-muted)", fontSize: "var(--text-sm)", textAlign: "center" }}>Событий пока нет</p> : recentActivity.map((a: any) => (
            <div key={a.id} style={{ padding: "8px 20px", borderBottom: "1px solid var(--border-light)", display: "flex", gap: 12, alignItems: "center", fontSize: "var(--text-xs)" }}>
              <span style={{ color: a.type.includes("error") ? "var(--red)" : a.type.includes("start") ? "var(--green)" : a.type.includes("stop") ? "var(--amber)" : "var(--ink-muted)", fontWeight: 600, minWidth: 80 }}>{new Date(a.createdAt).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}</span>
              <span style={{ color: "var(--ink-muted)", fontSize: "0.65rem", minWidth: 70, textTransform: "uppercase" }}>{a.type}</span>
              <span style={{ color: "var(--ink-body)" }}>{a.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)" };
const td: React.CSSProperties = { padding: "12px 16px", fontSize: "var(--text-sm)" };
