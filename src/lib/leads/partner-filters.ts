import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { ClientGenderFilter } from "./name-gender";

export type PartnerFilterInput = {
  keywords?: string;
  minusKeywords?: string;
  budgetMin?: number;
  budgetMax?: number;
  showNoBudget?: boolean;
  workHoursStart?: string;
  workHoursEnd?: string;
  clientGender?: ClientGenderFilter | string;
};

export type PartnerFilters = {
  keywords: string;
  minusKeywords: string;
  budgetMin: number;
  budgetMax: number;
  showNoBudget: boolean;
  workHoursStart: string;
  workHoursEnd: string;
  clientGender: ClientGenderFilter;
};

const WORD_MAX = 40;
const LIST_MAX = 20;
const LIST_CHARS = 400;

function sanitizeWordList(raw: unknown): string {
  const parts = String(raw || "")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 2 && w.length <= WORD_MAX)
    .slice(0, LIST_MAX);
  const joined = parts.join(", ");
  return joined.slice(0, LIST_CHARS);
}

function parseHour(s: string, fallback: number): number {
  const h = parseInt(String(s || "").split(":")[0] || "", 10);
  return Number.isFinite(h) ? h : fallback;
}

function clampHours(startRaw: string, endRaw: string): { start: string; end: string } {
  let startH = Math.max(8, Math.min(21, parseHour(startRaw, 8)));
  let endH = Math.max(9, Math.min(22, parseHour(endRaw, 22)));
  if (endH <= startH) endH = Math.min(22, startH + 1);
  const work = endH - startH;
  if (work > 18) endH = startH + 18;
  return {
    start: `${String(startH).padStart(2, "0")}:00`,
    end: `${String(endH).padStart(2, "0")}:00`,
  };
}

export function parsePartnerFilters(input: PartnerFilterInput): PartnerFilters {
  const hours = clampHours(String(input.workHoursStart || "08:00"), String(input.workHoursEnd || "22:00"));
  const gender: ClientGenderFilter =
    input.clientGender === "male" || input.clientGender === "female" ? input.clientGender : "all";
  let budgetMin = Math.max(0, parseInt(String(input.budgetMin ?? 0), 10) || 0);
  let budgetMax = Math.max(0, parseInt(String(input.budgetMax ?? 0), 10) || 0);
  if (budgetMax && budgetMin && budgetMax < budgetMin) {
    const t = budgetMin;
    budgetMin = budgetMax;
    budgetMax = t;
  }
  return {
    keywords: sanitizeWordList(input.keywords),
    minusKeywords: sanitizeWordList(input.minusKeywords),
    budgetMin,
    budgetMax: budgetMax || 500000,
    showNoBudget: input.showNoBudget !== false,
    workHoursStart: hours.start,
    workHoursEnd: hours.end,
    clientGender: gender,
  };
}

export function isWithinPartnerHours(start: string, end: string, now = new Date()): boolean {
  const h = new Date(now.getTime() + 3 * 3600 * 1000).getUTCHours();
  const a = parseHour(start, 8);
  const b = parseHour(end, 22);
  return h >= a && h < b;
}

export function budgetPasses(
  leadBudget: number | null | undefined,
  filters: Pick<PartnerFilters, "budgetMin" | "budgetMax" | "showNoBudget">,
): boolean {
  if (leadBudget == null || !Number.isFinite(leadBudget)) return filters.showNoBudget !== false;
  if (filters.budgetMin && leadBudget < filters.budgetMin) return false;
  if (filters.budgetMax && leadBudget > filters.budgetMax) return false;
  return true;
}

export function filtersFromConfig(cfg: Record<string, unknown>, settings?: Record<string, unknown> | null): PartnerFilters {
  return parsePartnerFilters({
    keywords: String(cfg.keywords ?? settings?.keywords ?? ""),
    minusKeywords: String(cfg.minusKeywords ?? settings?.minusKeywords ?? ""),
    budgetMin: Number(cfg.budgetMin ?? settings?.budgetMin ?? 0),
    budgetMax: Number(cfg.budgetMax ?? settings?.budgetMax ?? 0),
    showNoBudget: (cfg.showNoBudget ?? settings?.showNoBudget) !== false,
    workHoursStart: String(cfg.workHoursStart ?? settings?.workHoursStart ?? "08:00"),
    workHoursEnd: String(cfg.workHoursEnd ?? settings?.workHoursEnd ?? "22:00"),
    clientGender: String(cfg.clientGender ?? "all"),
  });
}

export async function applyPartnerFilters(workspaceId: string, input: PartnerFilterInput): Promise<PartnerFilters> {
  const filters = parsePartnerFilters(input);
  await db.settings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      keywords: filters.keywords,
      minusKeywords: filters.minusKeywords,
      budgetMin: filters.budgetMin || 0,
      budgetMax: filters.budgetMax,
      showNoBudget: filters.showNoBudget,
      workHoursStart: filters.workHoursStart,
      workHoursEnd: filters.workHoursEnd,
    },
    update: {
      keywords: filters.keywords,
      minusKeywords: filters.minusKeywords,
      budgetMin: filters.budgetMin || 0,
      budgetMax: filters.budgetMax,
      showNoBudget: filters.showNoBudget,
      workHoursStart: filters.workHoursStart,
      workHoursEnd: filters.workHoursEnd,
    },
  });

  const sources = await db.source.findMany({ where: { workspaceId, platform: "profi" } });
  for (const source of sources) {
    const cfg = { ...((source.config as Record<string, unknown>) || {}) };
    cfg.keywords = filters.keywords;
    cfg.minusKeywords = filters.minusKeywords;
    cfg.budgetMin = filters.budgetMin || null;
    cfg.budgetMax = filters.budgetMax || null;
    cfg.showNoBudget = filters.showNoBudget;
    cfg.workHoursStart = filters.workHoursStart;
    cfg.workHoursEnd = filters.workHoursEnd;
    cfg.clientGender = filters.clientGender;
    cfg._filtersUpdatedAt = new Date().toISOString();
    await db.source.update({
      where: { id: source.id },
      data: { config: cfg as Prisma.InputJsonValue },
    });
  }
  return filters;
}
