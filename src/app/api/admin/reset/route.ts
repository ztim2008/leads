import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Проверка роли admin
  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const { workspaceId } = await req.json();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  // Проверить что workspace существует
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  // Удаляем всё связанное с заявками
  await db.response.deleteMany({ where: { lead: { workspaceId } } });
  await db.leadAnalysis.deleteMany({ where: { lead: { workspaceId } } });
  await db.lead.deleteMany({ where: { workspaceId } });
  await db.activityLog.deleteMany({ where: { workspaceId } });

  return NextResponse.json({ ok: true, deletedWorkspace: workspaceId });
}
