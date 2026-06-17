// Макет панели управления — плотная сетка 0px, тёмная/светлая тема
import Link from "next/link";
import { auth, signOut } from "@/lib/auth/auth";
import {
  LayoutDashboard, Inbox, Plug, Settings, BarChart3,
  LogOut, Shield, Sparkles,
} from "lucide-react";
import ThemeToggle from "@/components/layout/theme-toggle";
import StatusIndicator from "@/components/layout/status-indicator";

const NAV = [
  { href: "/dashboard", label: "Обзор", icon: LayoutDashboard },
  { href: "/dashboard/leads", label: "Заявки", icon: Inbox },
  { href: "/dashboard/sources", label: "Источники", icon: Plug },
  { href: "/dashboard/settings", label: "Настройки", icon: Settings },
  { href: "/dashboard/admin", label: "Админ", icon: Shield },
  { href: "/dashboard/analytics", label: "Аналитика", icon: BarChart3 },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg-root)",
      }}>
        <div style={{ textAlign: "center" }}>
          <Sparkles size={48} style={{ color: "var(--accent)", marginBottom: 24 }} />
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 8 }}>
            Доступ запрещён
          </h1>
          <p style={{ color: "var(--ink-muted)", marginBottom: 24 }}>
            Войдите в систему чтобы открыть панель управления
          </p>
          <Link href="/auth" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "var(--accent)", color: "#fff",
            borderRadius: "var(--radius-sm)", padding: "12px 24px",
            fontWeight: 600, fontSize: "var(--text-sm)",
          }}>
            Войти
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg-layer)",
      display: "flex",
    }}>
      {/* ─── Боковая панель ──────────────────────────────── */}
      <aside style={{
        width: 240, flexShrink: 0,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh",
      }}>
        {/* Лого */}
        <div style={{ padding: "20px 20px 16px" }}>
          <Link href="/dashboard" style={{
            display: "flex", alignItems: "center", gap: 10,
            fontSize: "var(--text-lg)", fontWeight: 700,
            color: "var(--ink-heading)", letterSpacing: "-0.02em",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "var(--radius-sm)",
              background: "var(--accent)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800,
            }}>
              ◈
            </div>
            Leads AI
          </Link>
        </div>

        {/* Навигация */}
        <nav style={{ flex: 1, padding: "8px 12px" }}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", borderRadius: "var(--radius-sm)",
                  fontSize: "var(--text-sm)", fontWeight: 500,
                  color: "var(--ink-body)",
                  transition: "background 0.1s",
                }}>
                  <item.icon size={18} strokeWidth={1.75} />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Низ боковой панели */}
        <div style={{
          padding: "12px", borderTop: "1px solid var(--border)",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <ThemeToggle />
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "8px 12px", borderRadius: "var(--radius-sm)",
            fontSize: "var(--text-sm)",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "var(--radius-sm)",
              background: "var(--accent-soft)", color: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700,
            }}>
              {session.user.email?.[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {session.user.email}
              </p>
            </div>
          </div>
          <form
            action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}
          >
            <button type="submit" style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              border: "none", background: "transparent",
              color: "var(--ink-muted)", fontSize: "var(--text-xs)",
              cursor: "pointer", fontWeight: 500,
            }}>
              <LogOut size={14} />
              Выйти
            </button>
          </form>
        </div>
      </aside>

      {/* ─── Контент ──────────────────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0, padding: "32px 36px" }}>
        {children}
      </main>
    </div>
  );
}
