import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { exec } from "child_process";
import { HUB_COLLECTOR_POLICY } from "@/config/hub";

function readCollectorStatus() {
  try {
    const statusPath = join(process.cwd(), ".collector-status.json");
    if (!existsSync(statusPath)) return null;
    return JSON.parse(readFileSync(statusPath, "utf-8"));
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const checks: any = {
    hub: {
      profiOnHub: HUB_COLLECTOR_POLICY.profiOnHub,
      policy: HUB_COLLECTOR_POLICY.reason,
      disabledSince: HUB_COLLECTOR_POLICY.disabledSince,
    },
  };

  const collectors = readCollectorStatus();
  if (collectors) {
    checks.collectors = collectors;
  }

  const allSources = await db.source.findMany({ include: { workspace: { include: { user: true } } } });
  checks.sources = allSources.map((s) => {
    const secs = s.lastCheckAt ? Math.floor((Date.now() - new Date(s.lastCheckAt).getTime()) / 1000) : null;
    const ad = (s.config as any)?.antiDetect || {};
    const adMode = ad.mode || (s.enabled ? "light" : "-");
    const agentMeta = (s.config as any)?._lastHeartbeat;
    return {
      id: s.id,
      user: s.workspace?.user?.email,
      platform: s.platform,
      status: s.status,
      enabled: s.enabled,
      lastError: s.lastError?.slice(0, 80),
      lastCheckSec: secs,
      login: (s.config as any)?.login || "",
      agentHeartbeat: agentMeta || null,
      antiDetect: {
        mode: adMode,
        delayMultiplier: ad.delayMultiplier,
        extraSkipPercent: ad.extraSkipPercent,
        disableDeepScan: ad.disableDeepScan,
      },
    };
  });

  const wss = await db.workspace.findMany({ include: { user: true } });
  checks.workspaces = await Promise.all(
    wss.map(async (ws) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayLeads = await db.lead.count({ where: { workspaceId: ws.id, createdAt: { gte: today } } });
      const totalLeads = await db.lead.count({ where: { workspaceId: ws.id } });
      const last = await db.lead.findFirst({
        where: { workspaceId: ws.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      return {
        user: ws.user?.email,
        total: totalLeads,
        today: todayLeads,
        lastMinAgo: last ? Math.floor((Date.now() - new Date(last.createdAt).getTime()) / 60000) : null,
      };
    }),
  );

  const totalToday = checks.workspaces.reduce((a: number, w: any) => a + (w.today || 0), 0);
  const totalAll = checks.workspaces.reduce((a: number, w: any) => a + (w.total || 0), 0);
  checks.summary = { today: totalToday, total: totalAll };

  const kworkOnline = collectors?.kwork?.running === true;
  checks.overall = kworkOnline || !HUB_COLLECTOR_POLICY.profiOnHub ? "ok" : "warning";
  return NextResponse.json(checks);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action === "restart-kwork") {
    exec("pm2 restart leads-kwork", (err) => {
      if (err) console.error("[admin] restart kwork error:", err);
    });
    return NextResponse.json({ ok: true, message: "Kwork-коллектор перезапускается..." });
  }

  if (action === "restart-server") {
    exec("pm2 restart leads-konversus", (err) => {
      if (err) console.error("[admin] restart server error:", err);
    });
    return NextResponse.json({ ok: true, message: "Сервер перезапускается..." });
  }

  if (action === "restart-health") {
    exec("pm2 restart leads-health", (err) => {
      if (err) console.error("[admin] restart health error:", err);
    });
    return NextResponse.json({ ok: true, message: "Health monitor перезапускается..." });
  }

  if (action === "restart-worker" || action === "restart-all") {
    return NextResponse.json(
      {
        error:
          "Центральный Profi-воркер отключён (Phase 0). Сбор Profi — только через VPS-агент партнёра.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}
