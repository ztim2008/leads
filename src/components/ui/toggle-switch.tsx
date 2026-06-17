"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ToggleSwitch({ field, defaultValue, workspaceId }: {
  field: string; defaultValue: boolean; workspaceId: string;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(defaultValue);
  const [loading, setLoading] = useState(false);

  async function handleChange() {
    const next = !checked;
    setChecked(next);
    setLoading(true);

    const fd = new FormData();
    fd.set(field, next ? "on" : "off");

    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, [field]: next }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <label style={{ position: "relative", display: "inline-block", width: 48, height: 28, flexShrink: 0, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
      <input type="checkbox" checked={checked} onChange={handleChange} style={{ opacity: 0, width: 0, height: 0 }} />
      <span style={{ position: "absolute", inset: 0, background: checked ? "var(--green)" : "var(--border)", borderRadius: 28, transition: "0.2s" }} />
      <span style={{ position: "absolute", height: 22, width: 22, left: checked ? 24 : 3, bottom: 3, background: "#fff", borderRadius: "50%", transition: "0.2s" }} />
    </label>
  );
}
