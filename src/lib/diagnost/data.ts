import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { StageRow } from "@/lib/diagnost/stages";
import type { AuditResult, BusinessType } from "@/lib/diagnost/types";

export const OWNER_COOKIE = "dg_owner";
export const DAILY_LIMIT = Number(process.env.DIAGNOST_DAILY_LIMIT || 20);
const QUEUE_LIMIT = 30;

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function newSlug(): string {
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export class LimitError extends Error {}

export async function createAudit(input: { url: string; host: string; hint: BusinessType | null; owner: string; ipHash: string; unlimited?: boolean }) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [mine, queued] = await Promise.all([
    db.diagnostAudit.count({ where: { ipHash: input.ipHash, createdAt: { gte: since } } }),
    db.diagnostAudit.count({ where: { status: { in: ["queued", "running"] } } }),
  ]);
  if (!input.unlimited && mine >= DAILY_LIMIT) throw new LimitError(`Лимит ${DAILY_LIMIT} аудитов в сутки исчерпан. Попробуйте завтра.`);
  if (queued >= QUEUE_LIMIT) throw new LimitError("Сейчас много проверок в очереди. Попробуйте через пару минут.");

  const prev = await db.diagnostAudit.findFirst({
    where: { ownerToken: input.owner, host: input.host, status: "done" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return db.diagnostAudit.create({
    data: {
      slug: newSlug(),
      ownerToken: input.owner,
      ipHash: input.ipHash,
      url: input.url,
      host: input.host,
      businessHint: input.hint,
      prevId: prev?.id ?? null,
    },
    select: { slug: true },
  });
}

export type AuditView = {
  slug: string;
  url: string;
  host: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  stages: StageRow[] | null;
  error: string | null;
  createdAt: string;
  queueAhead: number;
  result: AuditResult | null;
  prev: { slug: string; overall: number | null; adReadiness: number | null; createdAt: string; result: AuditResult | null } | null;
};

export async function getAuditView(slug: string): Promise<AuditView | null> {
  const audit = await db.diagnostAudit.findUnique({ where: { slug } });
  if (!audit) return null;
  const queueAhead =
    audit.status === "queued"
      ? await db.diagnostAudit.count({ where: { status: { in: ["queued", "running"] }, createdAt: { lt: audit.createdAt } } })
      : 0;
  const prev = audit.prevId
    ? await db.diagnostAudit.findUnique({
        where: { id: audit.prevId },
        select: { slug: true, overall: true, adReadiness: true, createdAt: true, result: true },
      })
    : null;
  return {
    slug: audit.slug,
    url: audit.url,
    host: audit.host,
    status: audit.status as AuditView["status"],
    progress: audit.progress,
    stages: (audit.stages as StageRow[] | null) ?? null,
    error: audit.error,
    createdAt: audit.createdAt.toISOString(),
    queueAhead,
    result: audit.status === "done" ? (audit.result as unknown as AuditResult) : null,
    prev: prev
      ? {
          slug: prev.slug,
          overall: prev.overall,
          adReadiness: prev.adReadiness,
          createdAt: prev.createdAt.toISOString(),
          result: (prev.result as unknown as AuditResult) ?? null,
        }
      : null,
  };
}

export type HistoryRow = {
  slug: string;
  host: string;
  status: string;
  overall: number | null;
  adReadiness: number | null;
  verdict: string | null;
  createdAt: string;
};

export async function listOwnerAudits(owner: string, take = 30): Promise<HistoryRow[]> {
  const rows = await db.diagnostAudit.findMany({
    where: { ownerToken: owner },
    orderBy: { createdAt: "desc" },
    take,
    select: { slug: true, host: true, status: true, overall: true, adReadiness: true, createdAt: true, result: true },
  });
  return rows.map((row) => ({
    slug: row.slug,
    host: row.host,
    status: row.status,
    overall: row.overall,
    adReadiness: row.adReadiness,
    verdict: (row.result as { verdict?: string } | null)?.verdict ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function auditIdBySlug(slug: string): Promise<string | null> {
  const row = await db.diagnostAudit.findUnique({ where: { slug }, select: { id: true } });
  return row?.id ?? null;
}
