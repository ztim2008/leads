"use client";

export default function ClientLoginButton({ email }: { email: string }) {
  async function handleClick() {
    const res = await fetch("/api/admin/login-as", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const d = await res.json();
    if (d.ok) window.open(d.url, "_blank");
    else alert("Ошибка: " + (d.error || "Неизвестно"));
  }

  return (
    <button onClick={handleClick} style={{
      padding: "4px 10px", borderRadius: "var(--radius-sm)", background: "var(--accent-soft)",
      color: "var(--accent)", border: "1px solid var(--accent)",
      fontSize: "var(--text-xs)", fontWeight: 600, cursor: "pointer",
    }}>🔑</button>
  );
}
