"use client";

import { LogOut } from "lucide-react";

export default function SignOutButton() {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/auth";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 14px",
        borderRadius: "var(--radius-sm)",
        border: "none",
        background: "transparent",
        color: "var(--ink-muted)",
        fontSize: "var(--text-xs)",
        cursor: "pointer",
        fontWeight: 500,
      }}
    >
      <LogOut size={14} />
      Выйти
    </button>
  );
}
