import Link from "next/link";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { LayoutDashboard, Inbox, Plug, Settings, BarChart3, Shield, Sparkles, CreditCard } from "lucide-react";
import ThemeToggle from "@/components/layout/theme-toggle";
import StatusIndicator from "@/components/layout/status-indicator";
import SignOutButton from "@/components/layout/signout-button";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "981enFOks++AvBhamoSqvoDPxzCIy8sVKuoZSTjHexQ=");

async function getUserFromToken() {
  try {
    const token = (await cookies()).get("leads_token")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, SECRET);
    return { email: payload.email as string, role: payload.role as string };
  } catch { return null; }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Check NextAuth session first, then fallback to leads_token
  let session = await auth();
  let userEmail = (session?.user as any)?.email;
  
  if (!userEmail) {
    const tokenUser = await getUserFromToken();
    if (tokenUser) userEmail = tokenUser.email;
  }

  if (!userEmail) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-root)" }}>
        <div style={{ textAlign: "center" }}>
          <Sparkles size={48} style={{ color: "var(--accent)", marginBottom: 24 }} />
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700 }}>Доступ запрещён</h1>
          <p style={{ color: "var(--ink-muted)", marginBottom: 24 }}>Войдите в систему</p>
          <Link href="/auth" style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--radius-sm)", padding: "12px 24px", fontWeight: 600, textDecoration: "none" }}>Войти</Link>
        </div>
      </div>
    );
  }

  let isAdmin = false;
  try {
    const dbUser = await db.user.findUnique({ where: { email: userEmail } });
    isAdmin = dbUser?.role === "admin";
  } catch {}

  const USER_NAV = [
    { href: "/dashboard", label: "Обзор", icon: LayoutDashboard },
    { href: "/dashboard/leads", label: "Заявки", icon: Inbox },
    { href: "/dashboard/sources", label: "Источники", icon: Plug },
    { href: "/dashboard/billing", label: "Тарифы", icon: CreditCard },
    { href: "/dashboard/settings", label: "Настройки", icon: Settings },
    { href: "/dashboard/analytics", label: "Аналитика", icon: BarChart3 },
  ];

  const ADMIN_NAV = [
    { href: "/dashboard/admin", label: "Мониторинг", icon: Shield },
    { href: "/dashboard/admin/billing", label: "Биллинг", icon: CreditCard },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-layer)", display: "flex" }}>
      <aside className="dash-sidebar" style={{ width: 240, flexShrink: 0, background: "var(--bg-surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "20px 20px 16px" }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--ink-heading)", textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>◈</div>Leads AI
          </Link>
        </div>
        <nav style={{ flex: 1, padding: "8px 12px", overflowY: "auto" }}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {USER_NAV.map((item) => (
              <li key={item.href}><Link href={item.href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--ink-body)", textDecoration: "none" }}><item.icon size={18} strokeWidth={1.75} />{item.label}</Link></li>
            ))}
          </ul>
          {isAdmin && (
            <>
              <div style={{ margin: "12px 0 4px 14px", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: 1, opacity: 0.6 }}>Админ</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                {ADMIN_NAV.map((item) => (
                  <li key={item.href}><Link href={item.href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--ink-body)", textDecoration: "none" }}><item.icon size={18} strokeWidth={1.75} />{item.label}</Link></li>
                ))}
              </ul>
            </>
          )}
        </nav>
        <div style={{ padding: "12px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
          <ThemeToggle />
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px" }}>
            <div style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{userEmail[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: "var(--text-xs)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</p></div>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: "32px 36px" }}>
        <div style={{ marginBottom: 24, display: "flex", justifyContent: "flex-end" }}><StatusIndicator /></div>
        {children}
      </main>
    </div>
  );
}
