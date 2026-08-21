"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

type Member = {
  id: string;
  email: string;
  firstName: string | null;
  role: string;
  roleLabel: string;
  loginEnabled: boolean;
  ownedClients: number;
  createdAt: string;
};

const box: CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: 16,
};
const inp: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  background: "var(--bg-layer)",
  color: "var(--ink-body)",
  fontSize: "var(--text-sm)",
};
const btn: CSSProperties = {
  padding: "8px 14px",
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  cursor: "pointer",
};

export default function TeamAdminApp() {
  const [users, setUsers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [cred, setCred] = useState<{ email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/team");
    const d = await r.json();
    if (r.ok) setUsers(d.users || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createSales() {
    setMsg(null);
    setCred(null);
    const r = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        email,
        name,
        password: password || undefined,
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      setMsg(d.error || "Ошибка");
      return;
    }
    setCred({ email: d.user.email, password: d.password });
    setEmail("");
    setName("");
    setPassword("");
    setMsg("Напарник создан. Сохраните пароль — повторно не покажем.");
    await load();
  }

  async function resetPassword(userId: string) {
    setCred(null);
    const r = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_password", userId }),
    });
    const d = await r.json();
    if (!r.ok) {
      setMsg(d.error || "Ошибка");
      return;
    }
    setCred({ email: d.email, password: d.password });
    setMsg("Пароль сброшен.");
  }

  async function setLogin(userId: string, loginEnabled: boolean) {
    await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_login", userId, loginEnabled }),
    });
    await load();
  }

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, marginBottom: 4 }}>Команда</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)", marginBottom: 20 }}>
        Роли и доступы. Напарник (sales) входит в «Наши клиенты» и видит только свои карточки.
      </p>

      {msg && <div style={{ ...box, marginBottom: 12 }}>{msg}</div>}
      {cred && (
        <div style={{ ...box, marginBottom: 12, borderColor: "var(--accent)" }}>
          <strong>Доступ</strong>
          <p style={{ margin: "8px 0 0", fontFamily: "ui-monospace, monospace", fontSize: "var(--text-sm)" }}>
            Логин: {cred.email}<br />
            Пароль: {cred.password}<br />
            Вход: https://leads.konversus.ru/auth → раздел Клиенты
          </p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ ...box, display: "flex", flexDirection: "column", gap: 8 }}>
          <strong>Добавить напарника</strong>
          <input style={inp} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input style={inp} placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            style={inp}
            placeholder="Пароль (пусто = сгенерировать)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" style={btn} onClick={createSales}>Создать роль sales</button>
        </div>

        <div style={box}>
          <strong>Участники</strong>
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>
            {users.map((u) => (
              <li key={u.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                <div style={{ fontWeight: 600 }}>{u.firstName || u.email}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                  {u.email} · {u.roleLabel}
                  {u.role === "sales" ? ` · клиентов: ${u.ownedClients}` : ""}
                  {!u.loginEnabled ? " · ВХОД ВЫКЛ" : ""}
                </div>
                {u.role === "sales" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button type="button" style={{ ...btn, fontSize: 12 }} onClick={() => resetPassword(u.id)}>
                      Сбросить пароль
                    </button>
                    <button
                      type="button"
                      style={{ ...btn, fontSize: 12, background: u.loginEnabled ? "#b45309" : "var(--accent)" }}
                      onClick={() => setLogin(u.id, !u.loginEnabled)}
                    >
                      {u.loginEnabled ? "Отключить вход" : "Включить вход"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
