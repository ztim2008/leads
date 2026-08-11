"use client";

import Link from "next/link";

type Props = { onCreated?: () => void };

export default function AddPartnerButton({ onCreated }: Props) {
  return (
    <Link
      href="/dashboard/admin/new"
      onClick={() => onCreated?.()}
      style={{
        padding: "10px 18px",
        borderRadius: "var(--radius-sm)",
        background: "var(--accent)",
        color: "#fff",
        border: "none",
        fontWeight: 600,
        fontSize: "var(--text-sm)",
        textDecoration: "none",
      }}
    >
      + Подключить партнёра
    </Link>
  );
}
