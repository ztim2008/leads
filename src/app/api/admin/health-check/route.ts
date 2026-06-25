import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { exec } from "child_process";

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
        cycles: worker.totalCycles,
        errors: worker.totalErrors,
        totalLeads: worker.totalLeadsCollected || 0,
        statusReason: worker.statusReason || "—",
        uptime: worker.uptime || 0,
        lastCheckAt: worker.lastCheckAt,
      };
    }
  } catch {}

  const allSources = await db.source.findMany({ include: { workspace: { include: { user: true } } } });
  checks.sources = allSources.map(s => {
    const secs = s.lastCheckAt ? Math.floor((Date.now() - new Date(s.lastCheckAt).getTime()) / 1000) : null;
    const ad = (s.config as any)?.antiDetect || {};
    const adMode = ad.mode || (s.enabled ? "light" : "-");
    return {
      id: s.id,
      user: s.workspace?.user?.email,
      platform: s.platform,
      status: s.status,
      enabled: s.enabled,
      lastError: s.lastError?.slice(0, 80),
      lastCheckSec: secs,
      login: (s.config as any)?.login || "",
      antiDetect: { mode: adMode, delayMultiplier: ad.delayMultiplier, extraSkipPercent: ad.extraSkipPercent, disableDeepScan: ad.disableDeepScan }
    };
  });

  const wss = await db.workspace.findMany({ include: { user: true } });
  checks.workspaces = await Promise.all(wss.map(async ws => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayLeads = await db.lead.count({ where: { workspaceId: ws.id, createdAt: { gte: today } } });
    const totalLeads = await db.lead.count({ where: { workspaceId: ws.id } });
    const last = await db.lead.findFirst({ where: { workspaceId: ws.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    return {
      user: ws.user?.email,
      total: totalLeads,
      today: todayLeads,
      lastMinAgo: last ? Math.floor((Date.now() - new Date(last.createdAt).getTime()) / 60000) : null
    };
  }));

  const totalToday = checks.workspaces.reduce((a: number, w: any) => a + (w.today || 0), 0);
  const totalAll = checks.workspaces.reduce((a: number, w: any) => a + (w.total || 0), 0);
  checks.summary = { today: totalToday, total: totalAll };

  const workerOk = checks.worker?.status === "ok";
  checks.overall = !workerOk ? "warning" : "ok";
  return NextResponse.json(checks);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action === "restart-worker") {
    exec("pm2 restart leads-worker", (err) => {
      if (err) console.error("[admin] restart worker error:", err);
    });
    return NextResponse.json({ ok: true, message: "Воркер перезапускается..." });
  }

  if (action === "restart-server") {
    exec("pm2 restart leads-konversus", (err) => {
      if (err) console.error("[admin] restart server error:", err);
    });
    return NextResponse.json({ ok: true, message: "Сервер перезапускается..." });
  }

  if (action === "restart-all") {
    exec("pm2 restart leads-konversus && pm2 restart leads-worker", (err) => {
      if (err) console.error("[admin] restart all error:", err);
    });
    return NextResponse.json({ ok: true, message: "Сервер и воркер перезапускаются..." });
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}
