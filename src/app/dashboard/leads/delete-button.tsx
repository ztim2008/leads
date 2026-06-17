"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Удалить заявку?")) return;
    setDeleting(true);
    try {
      await fetch("/api/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      router.refresh();
    } catch (e) {
      console.error(e);
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 36, height: 36, borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border)", background: "var(--bg-surface)",
        color: "var(--ink-muted)", cursor: "pointer",
        opacity: deleting ? 0.5 : 1,
      }}
      title="Удалить"
    >
      <Trash2 size={15} />
    </button>
  );
}
