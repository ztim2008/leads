"use client";

import { useState, useEffect } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const agreed = localStorage.getItem("cookie-consent");
    if (!agreed) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem("cookie-consent", "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "var(--bg-surface)", borderTop: "1px solid var(--border)",
      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      padding: "16px 20px",
      display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
      gap: 16, fontSize: "0.8rem", color: "var(--ink-body)",
    }}>
      <div style={{ flex: "1 1 300px", lineHeight: 1.5 }}>
        <span style={{ fontWeight: 600, color: "var(--ink-heading)" }}>🍪 Cookie</span>
        {" "}
        Мы используем файлы cookie для авторизации и работы сервиса.
        Продолжая, вы соглашаетесь с{" "}
        <a href="/privacy" style={{ color: "var(--accent)", textDecoration: "underline" }}>политикой конфиденциальности</a>
        {" и "}
        <a href="/oferta" style={{ color: "var(--accent)", textDecoration: "underline" }}>офертой</a>.
      </div>
      <button onClick={accept} style={{
        padding: "10px 24px", borderRadius: 8,
        background: "var(--accent)", color: "#fff",
        border: "none", fontWeight: 600, fontSize: "0.8rem",
        cursor: "pointer", whiteSpace: "nowrap",
      }}>
        Хорошо
      </button>
    </div>
  );
}
