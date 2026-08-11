"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/admin", label: "Все партнёры", exact: true },
  { href: "/dashboard/admin/new", label: "+ Подключить" },
  { href: "/dashboard/admin/billing", label: "Лимиты" },
  { href: "/dashboard/admin/assistant", label: "Помощник" },
  { href: "/dashboard/admin/system", label: "Система" },
];

export default function AdminNav() {
  const path = usePathname();

  return (
    <div style={{ marginBottom: 28 }}>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--ink-heading)", marginBottom: 4 }}>
        Оператор
      </h1>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginBottom: 16 }}>
        Подключение партнёров, лимиты заявок и мониторинг агентов
      </p>
      <nav
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
        }}
      >
        {TABS.map((tab) => {
          const active = tab.exact ? path === tab.href : path.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: "10px 16px",
                fontSize: "var(--text-sm)",
                fontWeight: active ? 700 : 500,
                color: active ? "var(--accent)" : "var(--ink-muted)",
                textDecoration: "none",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
