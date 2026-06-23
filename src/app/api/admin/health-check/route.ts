import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const checks: any = {};

  try {
    const statusPath = join(process.cwd(), ".worker-status.json");
    if (existsSync(statusPath)) {
      const worker = JSON.parse(readFileSync(statusPath, "utf-8"));
      const secs = worker.lastCheckAt ? Math.floor((Date.now() - new Date(worker.lastCheckAt).getTime()) / 1000) : null;
      checks.worker = {
        running: worker.running,
        lastCheckSec: secs,
        status: !worker.running ? "error" : secs && secs > 300 ? "warning" : "ok",
        cycles: worker.totalCycles, errors: worker.totalErrors, interval: worker.checkIntervalMin,
      };
    }
  } catch {}

  const sources = await db.source.findMany({ where: { enabled: true }, include: { workspace: { include: { user: true } } } });
  checks.sources = sources.map(s => {
    const secs = s.lastCheckAt ? Math.floor((Date.now() - new Date(s.lastCheckAt).getTime()) / 1000) : null;
    return { user: s.workspace?.user?.email, platform: s.platform, status: s.status, lastError: s.lastError?.slice(0,80), lastCheckSec: secs };
  });

  const wss = await db.workspace.findMany({ include: { user: true } });
  checks.workspaces = await Promise.all(wss.map(async ws => {
    const today = new Date(); today.setHours(0,0,0,0);
    const todayLeads = await db.lead.count({ where: { workspaceId: ws.id, createdAt: { gte: today } } });
    const last = await db.lead.findFirst({ where: { workspaceId: ws.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    return { user: ws.user?.email, total: await db.lead.count({ where: { workspaceId: ws.id } }), today: todayLeads, lastMinAgo: last ? Math.floor((Date.now()-new Date(last.createdAt).getTime())/60000) : null };
  }));

  const workerOk = checks.worker?.status === "ok";
  checks.overall = workerOk ? "ok" : checks.worker?.status || "error";
  return NextResponse.json(checks);
}
