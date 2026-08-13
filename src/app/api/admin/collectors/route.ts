import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { HUB_COLLECTOR_POLICY } from "@/config/hub";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauth" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Read collector status
  let collectors: any = {};
  try {
    const statusFile = join(process.cwd(), ".collector-status.json");
    if (existsSync(statusFile)) {
      collectors = JSON.parse(readFileSync(statusFile, "utf-8"));
    }
  } catch {}

  // Read PM2 status
  let pm2: any = {};
  try {
    const { execSync } = require("child_process");
    const raw = execSync("pm2 jlist 2>/dev/null", { timeout: 5000 }).toString();
    const procs = JSON.parse(raw);
    for (const p of procs) {
      if (p.name?.startsWith("leads-")) {
        pm2[p.name] = {
          status: p.pm2_env?.status,
          uptime: Math.round((Date.now() - p.pm2_env?.pm_uptime) / 1000),
          restarts: p.pm2_env?.restart_time,
          memory: Math.round(p.monit?.memory / 1024 / 1024),
          cpu: p.monit?.cpu,
        };
      }
    }
  } catch {}

  // Lead stats
  const today = new Date(); today.setHours(0,0,0,0);
  const partnerWs = { workspace: { user: { role: { not: "admin" as const } } } };
  const [total, todayLeads, profiCount, kworkCount] = await Promise.all([
    db.lead.count({ where: partnerWs }),
    db.lead.count({ where: { createdAt: { gte: today }, ...partnerWs } }),
    db.lead.count({ where: { source: { platform: "profi" }, ...partnerWs } }),
    db.lead.count({ where: { source: { platform: "kwork" }, ...partnerWs } }),
  ]);

  return NextResponse.json({
    hub: HUB_COLLECTOR_POLICY,
    collectors,
    pm2,
    stats: { total, today: todayLeads, profi: profiCount, kwork: kworkCount },
  });
}
