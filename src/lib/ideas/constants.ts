/** Статусы Ideas Board (строки в БД, без Prisma enum). */
export const IDEA_STATUSES = [
  "draft",
  "analyzing",
  "ready",
  "discussing",
  "parked",
  "done",
  "rejected",
] as const;

export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  draft: "Черновик",
  analyzing: "Анализ",
  ready: "Готово",
  discussing: "Обсуждение",
  parked: "Отложено",
  done: "Сделано",
  rejected: "Отклонено",
};

export const IDEA_STATUS_COLORS: Record<IdeaStatus, string> = {
  draft: "var(--ink-muted)",
  analyzing: "var(--accent)",
  ready: "var(--green)",
  discussing: "var(--accent)",
  parked: "var(--ink-muted)",
  done: "var(--green)",
  rejected: "var(--red)",
};

export function isIdeaStatus(value: unknown): value is IdeaStatus {
  return typeof value === "string" && (IDEA_STATUSES as readonly string[]).includes(value);
}

export function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return Array.from(
      new Set(
        raw
          .map((t) => String(t || "").trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 12),
      ),
    );
  }
  if (typeof raw === "string") {
    return Array.from(
      new Set(
        raw
          .split(/[,;\n]/)
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 12),
      ),
    );
  }
  return [];
}
