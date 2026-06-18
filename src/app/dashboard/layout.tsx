// Макет панели управления
import Link from "next/link";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { LayoutDashboard, Inbox, Plug, Settings, BarChart3, LogOut, Shield, Sparkles } from "lucide-react";
import ThemeToggle from "@/components/layout/theme-toggle";
import StatusIndicator from "@/components/layout/status-indicator";
import SignOutButton from "@/components/layout/signout-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-root)" }}>
        <div style={{ textAlign: "center" }}>
          <Sparkles size={48} style={{ color: "var(--accent)", marginBottom: 24 }} />
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 8 }}>Доступ запрещён</h1>
          <p style={{ color: "var(--ink-muted)", marginBottom: 24 }}>Войдите в систему</p>
          <Link href="/auth" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--accent)", color: "#fff", borderRadius: "var(--radius-sm)", padding: "12px 24px", fontWeight: 600, textDecoration: "none" }}>Войти</Link>
        </div>
      </div>
    );
  }

  // Проверка роли
  let isAdmin = false;
  try {
    const dbUser = await db.user.findUnique({ where: { email: (session.user as any).email } });
    isAdmin = dbUser?.role === "admin";
  } catch {}

  const NAV = [
    { href: "/dashboard", label: "Обзор", icon: LayoutDashboard },
    { href: "/dashboard/leads", label: "Заявки", icon: Inbox },
    { href: "/dashboard/sources", label: "Источники", icon: Plug },
    { href: "/dashboard/settings", label: "Настройки", icon: Settings },
    ...(isAdmin ? [{ href: "/dashboard/admin", label: "Админ", icon: Shield }] : []),
    { href: "/dashboard/analytics", label: "Аналитика", icon: BarChart3 },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-layer)", display: "flex" }}>
      <aside className="dash-sidebar" style={{ width: 240, flexShrink: 0, background: "var(--bg-surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        {/* Мобильный заголовок с гамбургером */}
        <div className="dash-mobile-header" style={{ display: "none", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <a href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "1rem", color: "#fafafa", textDecoration: "none" }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>◈</div>
            Leads AI
          </a>
          <label htmlFor="dash-menu-checkbox" style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", color: "var(--ink-body)", cursor: "pointer", fontSize: "1.2rem", display: "flex", alignItems: "center" }}>☰</label>
        </div>
        <div style={{ padding: "20px 20px 16px" }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--ink-heading)", textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>◈</div>Leads AI
          </Link>
        </div>
        <input type="checkbox" id="dash-menu-checkbox" style={{ display: "none" }} />
        <nav id="dash-nav" style={{ flex: 1, padding: "8px 12px" }}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {NAV.map((item) => (
              <li key={item.href}><Link href={item.href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--ink-body)", textDecoration: "none" }}><item.icon size={18} strokeWidth={1.75} />{item.label}</Link></li>
            ))}
          </ul>
        </nav>
        <div style={{ padding: "12px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
          <ThemeToggle />
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px" }}>
            <div style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{(session.user.email || "?")[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: "var(--text-xs)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.user.email}</p></div>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: "32px 36px" }}>
        <div style={{ marginBottom: 24, display: "flex", justifyContent: "flex-end" }}><StatusIndicator /></div>
        {children}
      <style>{`
        @media (max-width: 768px) {
          .dash-sidebar { width: 100% !important; height: auto !important; position: relative !important; border-right: none !important; border-bottom: 1px solid var(--border) !important; }
          .dash-mobile-header { display: flex !important; }
          #dash-nav { display: none; }
          #dash-menu-checkbox:checked ~ #dash-nav { display: block !important; }
        }
        @media (min-width: 769px) {
          .dash-mobile-header { display: none !important; }
          #dash-nav { display: block !important; }
        }
      `}</style>
    </main>
    </div>
  );
}
