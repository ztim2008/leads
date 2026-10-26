import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { renderRentgen } from "@/lib/rentgen/render";

const STALE_MS = 5 * 60 * 1000;

export async function claimNextScan(): Promise<string | null> {
  await db.rentgenScan.updateMany({
    where: { status: "running", startedAt: { lt: new Date(Date.now() - STALE_MS) } },
    data: { status: "failed", error: "Проверка прервалась по времени", finishedAt: new Date() },
  });
  const next = await db.rentgenScan.findFirst({ where: { status: "queued" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!next) return null;
  const claimed = await db.rentgenScan.updateMany({
    where: { id: next.id, status: "queued" },
    data: { status: "running", startedAt: new Date(), progress: 5 },
  });
  return claimed.count === 1 ? next.id : null;
}

export async function processScan(id: string): Promise<void> {
  const scan = await db.rentgenScan.findUnique({ where: { id } });
  if (!scan || scan.status !== "running") return;
  try {
    const result = await renderRentgen(scan.url, scan.id, (progress) => {
      db.rentgenScan.updateMany({ where: { id, status: "running" }, data: { progress } }).catch(() => undefined);
    });
    await db.rentgenScan.update({
      where: { id },
      data: { status: "done", progress: 100, result: result as unknown as Prisma.InputJsonValue, finishedAt: new Date() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0].slice(0, 300) : "Браузер не открыл сайт";
    console.error("[rentgen]", scan.host, message);
    await db.rentgenScan.update({ where: { id }, data: { status: "failed", error: message, finishedAt: new Date() } });
  }
}
