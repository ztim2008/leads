"use client";

export default function ExitImpersonationButton() {
  async function handleClick() {
    const res = await fetch("/api/admin/exit-impersonation", { method: "POST" });
    const d = await res.json();
    if (d.ok) window.location.href = d.url;
    else alert(d.error || "Ошибка");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        width: "100%",
        marginBottom: 8,
        padding: "8px 12px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--accent)",
        background: "var(--accent-soft)",
        color: "var(--accent)",
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      ↩ Вернуться в админ
    </button>
  );
}
