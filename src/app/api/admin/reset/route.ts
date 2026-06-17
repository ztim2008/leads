import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId } = await req.json();

  // Удаляем всё связанное с заявками
  if (workspaceId) {
    await db.response.deleteMany({ where: { lead: { workspaceId } } });
    await db.leadAnalysis.deleteMany({ where: { lead: { workspaceId } } });
    await db.lead.deleteMany({ where: { workspaceId } });
    await db.activityLog.deleteMany({ where: { workspaceId } });
  }

  return NextResponse.json({ ok: true });
}
