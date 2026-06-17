import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leadId } = await req.json();
  if (!leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }

  // Проверяем что заявка принадлежит workspace пользователя
  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
  });
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const lead = await db.lead.findFirst({
    where: { id: leadId, workspaceId: workspace.id },
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  await db.lead.delete({ where: { id: leadId } });

  return NextResponse.json({ ok: true });
}
