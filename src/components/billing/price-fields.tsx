"use client";

import { useEffect, useState } from "react";
import type { OperatorPriceSheet } from "@/lib/billing/operator-pricing";

const FIELDS: { key: keyof OperatorPriceSheet; label: string; suffix: string }[] = [
  { key: "connectFeeRub", label: "Подключение, разово", suffix: "₽" },
  { key: "aiApiUsd", label: "API ИИ, $", suffix: "$" },
  { key: "aiApiRub", label: "API ИИ, руб/мес", suffix: "₽" },
  { key: "supportFeeRub", label: "Поддержка, руб/мес", suffix: "₽" },
  { key: "vpsPerDayRub", label: "VPS, руб/день", suffix: "₽" },
];

export function PriceFields({
  values,
  onSave,
  saveLabel = "Сохранить цены",
}: {
  values: OperatorPriceSheet;
  onSave: (next: OperatorPriceSheet) => void;
  saveLabel?: string;
}) {
  const [p, setP] = useState(values);
  useEffect(() => {
    setP(values);
  }, [values.connectFeeRub, values.aiApiRub, values.aiApiUsd, values.supportFeeRub, values.vpsPerDayRub]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        {FIELDS.map((f) => (
          <label key={f.key} style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
            {f.label}
            <input
              type="number"
              min={0}
              value={p[f.key]}
              onChange={(e) => setP({ ...p, [f.key]: Number.parseInt(e.target.value, 10) || 0 })}
              style={inp}
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onSave(p)}
        style={{
          marginTop: 10,
          padding: "6px 12px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          background: "var(--bg-layer)",
          fontSize: "var(--text-xs)",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {saveLabel}
      </button>
    </div>
  );
}

const inp: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "6px 8px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  fontSize: "var(--text-sm)",
  boxSizing: "border-box",
};
