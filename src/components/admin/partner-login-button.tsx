"use client";

import { useRouter } from "next/navigation";

export default function PartnerLoginButton({ email }: { email: string }) {
  const router = useRouter();
  
  async function loginAs() {
    const res = await fetch("/api/admin/login-as", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const d = await res.json();
    if (d.ok) window.open(d.url, "_blank");
    else alert("Ошибка: " + (d.error || "Неизвестно"));
  }

  return (
    <button
      onClick={loginAs}
      style={{
        padding: "8px 16px", borderRadius: "var(--radius-sm)",
        background: "var(--accent)", color: "#fff", border: "none",
        fontWeight: 600, fontSize: "var(--text-sm)", cursor: "pointer",
      }}
    >
      🔑 Войти как партнёр
    </button>
  );
}
