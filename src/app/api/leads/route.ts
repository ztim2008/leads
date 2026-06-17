import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";

// PATCH — изменить статус заявки
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId, status } = await req.json();
  if (!leadId || !status) return NextResponse.json({ error: "leadId and status required" }, { status: 400 });

  // Найти workspace пользователя
  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const workspace = await db.workspace.findFirst({ where: { userId: user.id } });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  // Проверить что заявка принадлежит workspace
  const lead = await db.lead.findFirst({ where: { id: leadId, workspaceId: workspace.id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  await db.lead.update({ where: { id: leadId }, data: { status } });
  return NextResponse.json({ ok: true });
}

// DELETE — удалить заявку
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId } = await req.json();
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const workspace = await db.workspace.findFirst({ where: { userId: user.id } });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const lead = await db.lead.findFirst({ where: { id: leadId, workspaceId: workspace.id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  await db.lead.delete({ where: { id: leadId } });
  return NextResponse.json({ ok: true });
}
