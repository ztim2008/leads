import { IDEA_STATUS_COLORS, IDEA_STATUS_LABELS, type IdeaStatus } from "@/lib/ideas/constants";

export default function IdeaStatusBadge({ status }: { status: string }) {
  const label = IDEA_STATUS_LABELS[status as IdeaStatus] || status;
  const color = IDEA_STATUS_COLORS[status as IdeaStatus] || "var(--ink-muted)";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 8px",
        borderRadius: "var(--radius-sm)",
        fontSize: "0.65rem",
        fontWeight: 700,
        letterSpacing: 0.2,
        color,
        background: "var(--bg-layer)",
        border: `1px solid ${color}`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
