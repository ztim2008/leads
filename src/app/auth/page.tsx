"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function AuthPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setIsRegister(p.get("tab") === "register");
    const err = p.get("error");
    if (err) setError(err === "CredentialsSignin" ? "Неверный email или пароль" : err);
  }, []);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError(null);
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: form.get("email") as string,
      password: form.get("password") as string,
      redirect: false,
    });
    if (res?.error) setError("Неверный email или пароль");
    else window.location.href = "/dashboard";
    setLoading(false);
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError(null);
    const form = new FormData(e.currentTarget);
    const email = (form.get("email") as string).trim();
    const password = form.get("password") as string;
    const name = (form.get("name") as string).trim();
    if (password.length < 6) { setError("Пароль: минимум 6 символов"); setLoading(false); return; }

    const res = await fetch("/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Ошибка"); setLoading(false); return; }

    const signRes = await signIn("credentials", { email, password, redirect: false });
    if (signRes?.error) setError("Аккаунт создан, но не удалось войти");
    else window.location.href = "/dashboard";
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

        {/* Табы */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid var(--border)", borderRadius: "var(--radius-lg) var(--radius-lg) 0 0", overflow: "hidden", marginBottom: -1, position: "relative", zIndex: 1 }}>
          <button onClick={() => { setIsRegister(false); setError(null); }} style={tabStyle(!isRegister)}>Вход</button>
          <button onClick={() => { setIsRegister(true); setError(null); }} style={tabStyle(isRegister)}>Регистрация</button>
        </div>

        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 var(--radius-lg) var(--radius-lg)", padding: "28px 24px" }}>
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "var(--red-soft)", color: "var(--red)", fontSize: "var(--text-xs)", fontWeight: 600, marginBottom: 16 }}>{error}</div>
          )}

          <form key={isRegister ? "reg" : "login"} onSubmit={isRegister ? handleRegister : handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {isRegister && <InputField label="Имя" name="name" type="text" placeholder="Алексей" />}
            <InputField label="Email" name="email" type="email" placeholder="ваш@email.ru" />
            <InputField label="Пароль" name="password" type="password" placeholder={isRegister ? "Минимум 6 символов" : "••••••••"} />
            <button type="submit" disabled={loading} style={btnStyle(loading)}>
              {loading ? "Загрузка..." : isRegister ? "Зарегистрироваться" : "Войти"}
            </button>
          </form>

          {/* Яндекс */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <p style={{ textAlign: "center", fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 12 }}>
              или {isRegister ? "зарегистрируйтесь" : "войдите"} через
            </p>
            <button onClick={() => signIn("yandex", { callbackUrl: "/dashboard" })} style={yandexBtnStyle}>
              <span style={{ fontSize: 18, fontWeight: 700 }}>Я</span>
              Войти с Яндекс ID
            </button>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
          {isRegister ? "Уже есть аккаунт? " : "Нет аккаунта? "}
          <button onClick={() => { setIsRegister(!isRegister); setError(null); }} style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 600, cursor: "pointer", fontSize: "var(--text-xs)", padding: 0, textDecoration: "underline" }}>
            {isRegister ? "Войти" : "Зарегистрироваться"}
          </button>
        </p>
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

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: "12px", textAlign: "center", fontWeight: 600, fontSize: "var(--text-sm)",
  background: active ? "var(--bg-surface)" : "var(--bg-layer)",
  color: active ? "var(--ink-heading)" : "var(--ink-muted)",
  borderBottom: active ? "2px solid var(--accent)" : "1px solid var(--border)",
  border: "none", cursor: "pointer",
});

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
