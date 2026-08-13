"use client";

export type FlowTone = "ok" | "warn" | "bad" | "off";

export type FlowNode = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  tone: FlowTone;
};

export type FlowEvent = {
  at?: string | null;
  label: string;
  tone?: FlowTone;
};

const TONE: Record<FlowTone, { border: string; bg: string; dot: string; label: string }> = {
  ok: { border: "var(--green)", bg: "var(--green-soft)", dot: "var(--green)", label: "ok" },
  warn: { border: "var(--amber)", bg: "#f59e0b14", dot: "var(--amber)", label: "внимание" },
  bad: { border: "var(--red)", bg: "var(--red-soft)", dot: "var(--red)", label: "ошибка" },
  off: { border: "var(--border)", bg: "var(--bg-hover)", dot: "var(--ink-muted)", label: "выкл" },
};

export function CollectorFlowMap({
  nodes,
  events,
  caption,
}: {
  nodes: FlowNode[];
  events?: FlowEvent[];
  caption?: string;
}) {
  return (
    <div>
      {caption && (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: 10 }}>{caption}</p>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "stretch",
          gap: 0,
        }}
      >
        {nodes.map((n, i) => (
          <div key={n.id} style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                minWidth: 132,
                maxWidth: 180,
                padding: "10px 12px",
                borderRadius: 10,
                border: `1.5px solid ${TONE[n.tone].border}`,
                background: TONE[n.tone].bg,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: TONE[n.tone].dot,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 700, fontSize: "0.72rem" }}>{n.title}</span>
              </div>
              {n.subtitle && (
                <div style={{ fontSize: "0.7rem", fontWeight: 600, wordBreak: "break-all" }}>{n.subtitle}</div>
              )}
              {n.meta && (
                <div style={{ fontSize: "0.65rem", color: "var(--ink-muted)", marginTop: 4 }}>{n.meta}</div>
              )}
            </div>
            {i < nodes.length - 1 && (
              <div
                aria-hidden
                style={{
                  width: 22,
                  height: 2,
                  background: "var(--border)",
                  margin: "0 4px",
                  position: "relative",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    right: -1,
                    top: -4,
                    border: "5px solid transparent",
                    borderLeftColor: "var(--border)",
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {events && events.length > 0 && (
        <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
          {events.map((e, i) => (
            <li
              key={i}
              style={{
                fontSize: "var(--text-xs)",
                padding: "4px 0",
                color: e.tone === "bad" ? "var(--red)" : e.tone === "warn" ? "var(--amber)" : "var(--ink-body)",
                borderBottom: "1px solid var(--border-light)",
              }}
            >
              <span style={{ color: "var(--ink-muted)", marginRight: 8 }}>{e.at || "—"}</span>
              {e.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ageShort(iso?: string | null): string {
  if (!iso) return "нет";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "<1 мин";
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} д назад`;
}

export function clock(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
