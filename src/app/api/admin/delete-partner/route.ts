import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!admin || admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.role === "admin") return NextResponse.json({ error: "Cannot delete admin" }, { status: 403 });

  // Удаляем всё связанное
  const workspaces = await db.workspace.findMany({ where: { userId: user.id } });
  for (const ws of workspaces) {
    await db.lead.deleteMany({ where: { workspaceId: ws.id } });
    await db.leadAnalysis.deleteMany({ where: { lead: { workspaceId: ws.id } } });
    await db.response.deleteMany({ where: { lead: { workspaceId: ws.id } } });
    await db.source.deleteMany({ where: { workspaceId: ws.id } });
    await db.settings.deleteMany({ where: { workspaceId: ws.id } });
    await db.subscription.deleteMany({ where: { workspaceId: ws.id } });
    await db.activityLog.deleteMany({ where: { workspaceId: ws.id } });
  }
  await db.workspace.deleteMany({ where: { userId: user.id } });
  await db.session.deleteMany({ where: { userId: user.id } });
  await db.user.delete({ where: { id: user.id } });

  return NextResponse.json({ ok: true });
}
