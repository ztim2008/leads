import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { HUB_COLLECTOR_POLICY } from "@/config/hub";

export async function GET() {
  let workspaceStats = null;
  try {
    const session = await auth();
    if (session?.user) {
      const user = await db.user.findUnique({ where: { email: (session.user as { email?: string }).email } });
      if (user) {
        const ws = await db.workspace.findFirst({
          where: { userId: user.id },
          include: { _count: { select: { leads: true } } },
        });
        if (ws) {
          const priorityCount = await db.leadAnalysis.count({
            where: { lead: { workspaceId: ws.id }, score: { gte: 70 } },
          });
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
  } catch { /* ignore */ }

  return NextResponse.json({
    running: true,
    statusReason: "Заявки собирает VPS-агент партнёра. Хаб только принимает.",
    hubPolicy: HUB_COLLECTOR_POLICY,
    collectors: {},
    lastCheckAt: null,
    workspace: workspaceStats,
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Управление центральным воркером отключено (Phase 0). Profi собирается только через VPS-агент.",
    },
    { status: 400 },
  );
}
