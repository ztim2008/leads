"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetButton({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!confirm("⚠️ Удалить ВСЕ заявки безвозвратно?\n\nНастройки и источники сохранятся.")) return;
    if (!confirm("Точно? Это необратимо.")) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (res.ok) router.refresh();
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  return (
    <button
      onClick={handleReset}
      disabled={loading}
      style={{
        padding: "10px 20px", borderRadius: "var(--radius-sm)",
        border: "1px solid var(--red)", background: "var(--red-soft)",
        color: "var(--red)", fontWeight: 600, fontSize: "var(--text-sm)",
        cursor: "pointer", opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? "Удаляю..." : "🗑 Сбросить все заявки"}
    </button>
  );
}
