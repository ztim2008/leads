import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function GET() {
  // Читаем глобальный статус воркера
  let worker: any = { running: false, statusReason: "Воркер не запущен" };
  try {
    const statusPath = join(process.cwd(), ".worker-status.json");
    if (existsSync(statusPath)) {
      worker = JSON.parse(readFileSync(statusPath, "utf-8"));
    }
  } catch {}

  // Пытаемся получить workspace-specific статистику
  let workspaceStats = null;
  try {
    const session = await auth();
    if (session?.user) {
      const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
      if (user) {
        const ws = await db.workspace.findFirst({
          where: { userId: user.id },
          include: { _count: { select: { leads: true } } },
        });
        if (ws) {
          // Приоритетные = score >= 70 через leadAnalysis
          const priorityCount = await db.leadAnalysis.count({
            where: { lead: { workspaceId: ws.id }, score: { gte: 70 } },
          });
          // От живых людей = botProbability <= 30
          const humanCount = await db.leadAnalysis.count({
            where: { lead: { workspaceId: ws.id }, botProbability: { lte: 30 } },
          });
          
          workspaceStats = {
            totalLeads: ws._count.leads,
            priorityLeads: priorityCount,
            humanLeads: humanCount,
          };
        }
      }
    }
  } catch {}

  return NextResponse.json({ ...worker, workspace: workspaceStats });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { exec } = require("child_process");
  if (body.action === "start") {
    exec("pm2 start leads-worker", () => {});
    return NextResponse.json({ ok: true });
  }
  if (body.action === "stop") {
    exec("pm2 stop leads-worker", () => {});
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "action must be 'start' or 'stop'" }, { status: 400 });
}
