import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { ClickItem, RentgenResult, RentgenView, ViewKind } from "@/lib/rentgen/types";

export const OWNER_COOKIE = "rg_owner";
export const DAILY_LIMIT = Number(process.env.RENTGEN_DAILY_LIMIT || 10);
const QUEUE_LIMIT = 20;
const REUSE_MS = 60 * 60 * 1000;
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export class LimitError extends Error {}

function newSlug(): string {
  return Array.from(randomBytes(12), (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Тот же адрес за последний час (готовый или в работе) — отдаём его, без нового скана и без списания лимита. */
export async function createScan(input: { url: string; host: string; owner: string; ipHash: string; unlimited?: boolean }): Promise<{ slug: string; reused: boolean }> {
  const recent = await db.rentgenScan.findFirst({
    where: { url: input.url, status: { in: ["queued", "running", "done"] }, createdAt: { gte: new Date(Date.now() - REUSE_MS) } },
    orderBy: { createdAt: "desc" },
    select: { slug: true },
  });
  if (recent) return { slug: recent.slug, reused: true };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [mine, queued] = await Promise.all([
    db.rentgenScan.count({ where: { ipHash: input.ipHash, createdAt: { gte: since } } }),
    db.rentgenScan.count({ where: { status: { in: ["queued", "running"] } } }),
  ]);
  if (!input.unlimited && mine >= DAILY_LIMIT) throw new LimitError(`Лимит ${DAILY_LIMIT} проверок в сутки исчерпан. Попробуйте завтра.`);
  if (queued >= QUEUE_LIMIT) throw new LimitError("Сейчас много проверок в очереди. Попробуйте через пару минут.");

  const scan = await db.rentgenScan.create({
    data: { slug: newSlug(), ownerToken: input.owner, ipHash: input.ipHash, url: input.url, host: input.host },
    select: { slug: true },
  });
  return { slug: scan.slug, reused: false };
}

export type PublicItem = Omit<ClickItem, "path">;
export type PublicView = Omit<RentgenView, "shot" | "items"> & { shot: string; items: PublicItem[] };
export type ScanView = {
  slug: string;
  url: string;
  host: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  error: string | null;
  createdAt: string;
  queueAhead: number;
  result: (Omit<RentgenResult, "views"> & { views: { desktop: PublicView; mobile: PublicView | null } }) | null;
};

function publicView(slug: string, kind: ViewKind, view: RentgenView): PublicView {
  return {
    ...view,
    shot: `/api/rentgen/${slug}/shot/${kind}`,
    items: view.items.map(({ path: _path, ...item }) => item),
  };
}

export async function getScanView(slug: string): Promise<ScanView | null> {
  const scan = await db.rentgenScan.findUnique({ where: { slug } });
  if (!scan) return null;
  // Рентген ждёт и свою очередь, и аудиты Техосмотра — воркер общий
  const queueAhead =
    scan.status === "queued"
      ? (await db.rentgenScan.count({ where: { status: { in: ["queued", "running"] }, createdAt: { lt: scan.createdAt } } })) +
        (await db.diagnostAudit.count({ where: { status: { in: ["queued", "running"] } } }))
      : 0;
  const raw = scan.status === "done" ? (scan.result as RentgenResult | null) : null;
  return {
    slug: scan.slug,
    url: scan.url,
    host: scan.host,
    status: scan.status as ScanView["status"],
    progress: scan.progress,
    error: scan.error,
    createdAt: scan.createdAt.toISOString(),
    queueAhead,
    result: raw
      ? {
          ...raw,
          views: {
            desktop: publicView(scan.slug, "desktop", raw.views.desktop),
            mobile: raw.views.mobile ? publicView(scan.slug, "mobile", raw.views.mobile) : null,
          },
        }
      : null,
  };
}

export async function scanIdBySlug(slug: string): Promise<string | null> {
  const scan = await db.rentgenScan.findUnique({ where: { slug }, select: { id: true, status: true } });
  return scan?.status === "done" ? scan.id : null;
}

export type HistoryRow = { slug: string; host: string; status: ScanView["status"]; createdAt: string; problems: number | null };

export async function listOwnerScans(owner: string, take = 20): Promise<HistoryRow[]> {
  const rows = await db.rentgenScan.findMany({
    where: { ownerToken: owner },
    orderBy: { createdAt: "desc" },
    take,
    select: { slug: true, host: true, status: true, createdAt: true, result: true },
  });
  return rows.map((row) => {
    const result = row.result as RentgenResult | null;
    const problems = result
      ? [result.views.desktop, result.views.mobile].reduce((sum, view) => sum + (view ? view.items.filter((item) => item.n !== null).length : 0), 0)
      : null;
    return { slug: row.slug, host: row.host, status: row.status as ScanView["status"], createdAt: row.createdAt.toISOString(), problems };
  });
}
