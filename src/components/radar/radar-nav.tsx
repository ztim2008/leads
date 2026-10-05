"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/radar", label: "Лента", exact: true },
  { href: "/dashboard/radar/profile", label: "Профиль" },
  { href: "/dashboard/radar/settings", label: "Настройки" },
];

export default function RadarNav() {
  const path = usePathname();

  return (
    <div style={{ marginBottom: 28 }}>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--ink-heading)", marginBottom: 4 }}>
        Job Radar
      </h1>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginBottom: 16 }}>
        Вакансии HH для вас. Партнёры этот раздел не видят.
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
