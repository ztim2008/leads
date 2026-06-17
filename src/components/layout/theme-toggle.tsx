"use client";

import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    setIsDark(stored === "dark");
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }

  return (
    <button
      onClick={toggle}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        width: "100%", padding: "8px 14px",
        borderRadius: "var(--radius-sm)",
        border: "none", background: "transparent",
        color: "var(--ink-muted)", fontSize: "var(--text-xs)",
        cursor: "pointer", fontWeight: 500,
      }}
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
      {isDark ? "Светлая тема" : "Тёмная тема"}
    </button>
  );
}
