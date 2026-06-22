"use client";

import { useState } from "react";

export default function PayButton({ plan }: { plan: string }) {
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const d = await res.json();
      if (d.confirmationUrl) {
        window.location.href = d.confirmationUrl;
      } else {
        alert("Ошибка: " + (d.error || "Неизвестно"));
      }
    } catch {
      alert("Ошибка соединения");
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handlePay}
      disabled={loading}
      style={{
        display: "block", width: "100%", textAlign: "center",
        padding: "12px", borderRadius: "var(--radius-sm)",
        background: "#fff", color: "var(--accent)",
        border: "none", fontWeight: 700, fontSize: "var(--text-sm)",
        cursor: "pointer", opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? "Загрузка..." : "Оплатить 700 ₽"}
    </button>
  );
}
