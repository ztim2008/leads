"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function AuthPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const err = p.get("error");
    if (err) setError(err === "CredentialsSignin" ? "Неверный email или пароль" : err);
  }, []);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    const apiRes = await fetch("/api/direct-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (apiRes.ok) {
      window.location.href = "/dashboard";
    } else {
      setError("Неверный email или пароль");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-layer)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--ink-heading)", letterSpacing: "-0.02em", textDecoration: "none" }}>
            <div style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>◈</div>
            Leads AI
          </Link>
        </div>

        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "28px 24px" }}>
          <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: 8, color: "var(--ink-heading)" }}>Вход</h1>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 20 }}>
            Аккаунты создаёт администратор. Саморегистрация отключена.
          </p>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "var(--red-soft)", color: "var(--red)", fontSize: "var(--text-xs)", fontWeight: 600, marginBottom: 16 }}>{error}</div>
          )}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <InputField label="Email" name="email" type="email" placeholder="ваш@email.ru" />
            <InputField label="Пароль" name="password" type="password" placeholder="••••••••" />
            <button type="submit" disabled={loading} style={btnStyle(loading)}>
              {loading ? "Загрузка..." : "Войти"}
            </button>
          </form>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <p style={{ textAlign: "center", fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 12 }}>
              или войдите через
            </p>
            <button onClick={() => signIn("yandex", { callbackUrl: "/dashboard" })} style={yandexBtnStyle}>
              <span style={{ fontSize: 18, fontWeight: 700 }}>Я</span>
              Войти с Яндекс ID
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputField({ label, name, type, placeholder }: { label: string; name: string; type: string; placeholder: string }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-body)", marginBottom: 6 }}>{label}</label>
      <input name={name} type={type} required placeholder={placeholder} style={{ width: "100%", padding: "11px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-root)", color: "var(--ink-body)", fontSize: "var(--text-sm)", outline: "none", boxSizing: "border-box" }} />
    </div>
  );
}

const btnStyle = (loading: boolean): React.CSSProperties => ({
  width: "100%", padding: "11px 14px", borderRadius: "var(--radius-sm)",
  border: "none", background: "var(--accent)", color: "#fff",
  fontWeight: 600, fontSize: "var(--text-sm)", cursor: "pointer",
  opacity: loading ? 0.7 : 1,
});

const yandexBtnStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: "var(--radius-sm)",
  border: "none", background: "#FC3F1D", color: "#fff",
  fontWeight: 600, fontSize: "var(--text-sm)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
};
