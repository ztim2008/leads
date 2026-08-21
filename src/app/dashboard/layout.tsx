import Link from "next/link";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import {
  LayoutDashboard,
  Inbox,
  Shield,
  Sparkles,
  CreditCard,
  Activity,
  Radio,
  SlidersHorizontal,
  Users,
  UserCog,
} from "lucide-react";
import ThemeToggle from "@/components/layout/theme-toggle";
import StatusIndicator from "@/components/layout/status-indicator";
import SignOutButton from "@/components/layout/signout-button";
import ExitImpersonationButton from "@/components/layout/exit-impersonation-button";
import { isAdminRole, isSalesRole, ROLE_LABELS } from "@/lib/auth/roles";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as {
    id?: string;
    email?: string;
    role?: string;
    impersonatorId?: string;
    impersonatorEmail?: string;
  } | undefined;

  if (!user?.email || !user.id) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-root)" }}>
        <div style={{ textAlign: "center" }}>
          <Sparkles size={48} style={{ color: "var(--accent)", marginBottom: 24 }} />
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700 }}>Доступ запрещён</h1>
          <p style={{ color: "var(--ink-muted)", marginBottom: 24 }}>Войдите в систему</p>
          <Link href="/auth" style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--radius-sm)", padding: "12px 24px", fontWeight: 600, textDecoration: "none" }}>
            Войти
          </Link>
        </div>
      </div>
    );
  }

  await db.user.findUnique({ where: { id: user.id } });
  const isImpersonating = !!user.impersonatorId;
  const isAdmin = isAdminRole(user.role) && !isImpersonating;
  const isSales = isSalesRole(user.role) && !isImpersonating;
  const isPartner = !isAdmin && !isSales;

  const PARTNER_NAV = [
    { href: "/dashboard", label: "Обзор", icon: LayoutDashboard },
    { href: "/dashboard/leads", label: "Заявки", icon: Inbox },
    { href: "/dashboard/settings", label: "Фильтры", icon: SlidersHorizontal },
    { href: "/dashboard/billing", label: "Счёт", icon: CreditCard },
  ];

  const ADMIN_OPERATOR_NAV = [
    { href: "/dashboard/admin/ops", label: "Пульт", icon: Radio },
    { href: "/dashboard/admin", label: "Партнёры", icon: Shield },
    { href: "/dashboard/crm", label: "Клиенты", icon: Users },
    { href: "/dashboard/admin/billing", label: "Счета", icon: CreditCard },
    { href: "/dashboard/admin/team", label: "Команда", icon: UserCog },
    { href: "/dashboard/admin/assistant", label: "Помощник", icon: Sparkles },
    { href: "/dashboard/admin/system", label: "Хаб", icon: Activity },
  ];

  const SALES_NAV = [{ href: "/dashboard/crm", label: "Клиенты", icon: Users }];

  const roleLabel = isImpersonating
    ? `Просмотр: ${user.email}`
    : ROLE_LABELS[user.role || ""] || user.role || "—";

  const homeHref = isAdmin ? "/dashboard/admin/ops" : isSales ? "/dashboard/crm" : "/dashboard";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-layer)", display: "flex" }}>
      <aside
        className="dash-sidebar"
        style={{
          width: 240,
          flexShrink: 0,
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div style={{ padding: "20px 20px 16px" }}>
          <Link
            href={homeHref}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: "var(--text-lg)",
              fontWeight: 700,
              color: "var(--ink-heading)",
              textDecoration: "none",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-sm)",
                background: "var(--accent)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 800,
              }}
            >
              ◈
            </div>
            Leads AI
          </Link>
        </div>

        <nav style={{ flex: 1, padding: "8px 12px", overflowY: "auto" }}>
          {isAdmin && (
            <>
              <div style={{ margin: "4px 0 8px 14px", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: 1, opacity: 0.6 }}>
                Оператор
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                {ADMIN_OPERATOR_NAV.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 14px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "var(--text-sm)",
                        fontWeight: 500,
                        color: "var(--ink-body)",
                        textDecoration: "none",
                      }}
                    >
                      <item.icon size={18} strokeWidth={1.75} />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {isSales && (
            <>
              <div style={{ margin: "4px 0 8px 14px", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: 1, opacity: 0.6 }}>
                Продажи
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                {SALES_NAV.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 14px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "var(--text-sm)",
                        fontWeight: 500,
                        color: "var(--ink-body)",
                        textDecoration: "none",
                      }}
                    >
                      <item.icon size={18} strokeWidth={1.75} />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p style={{ margin: "12px 14px", fontSize: "0.65rem", color: "var(--ink-muted)", lineHeight: 1.4 }}>
                Видны только ваши клиенты. Подключение в системе делает администратор.
              </p>
            </>
          )}

          {(isPartner || isImpersonating) && (
            <>
              <div style={{ margin: "12px 0 8px 14px", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: 1, opacity: 0.6 }}>
                Партнёр
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                {PARTNER_NAV.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 14px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "var(--text-sm)",
                        fontWeight: 500,
                        color: "var(--ink-body)",
                        textDecoration: "none",
                      }}
                    >
                      <item.icon size={18} strokeWidth={1.75} />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              {isPartner && !isImpersonating && (
                <p style={{ margin: "12px 14px", fontSize: "0.65rem", color: "var(--ink-muted)", lineHeight: 1.4 }}>
                  Фильтры заявок — в разделе «Фильтры». Profi и VPS настраивает администратор.
                </p>
              )}
            </>
          )}
        </nav>

        <div style={{ padding: "12px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
          {isImpersonating && <ExitImpersonationButton />}
          <ThemeToggle />
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px" }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "var(--radius-sm)",
                background: isAdmin ? "#7c3aed20" : isSales ? "#0d948820" : "var(--accent-soft)",
                color: isAdmin ? "#7c3aed" : isSales ? "#0d9488" : "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {user.email[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.email}
              </p>
              <p style={{ fontSize: "0.6rem", color: "var(--ink-muted)" }}>{roleLabel}</p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: "32px 36px" }}>
        {isPartner && (
          <div style={{ marginBottom: 24, display: "flex", justifyContent: "flex-end" }}>
            <StatusIndicator />
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
