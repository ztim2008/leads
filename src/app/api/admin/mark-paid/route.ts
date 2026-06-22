import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email } = await req.json();
  const partner = await db.user.findUnique({ where: { email } });
  if (!partner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ws = await db.workspace.findFirst({ where: { userId: partner.id } });
  if (!ws) return NextResponse.json({ error: "No workspace" }, { status: 404 });

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const existing = await db.subscription.findFirst({ where: { workspaceId: ws.id } });

  if (existing) {
    await db.subscription.update({ where: { id: existing.id }, data: { plan: "pro", status: "active", leadsPerDay: 999999, sourcesLimit: 999, aiAnalysis: true, aiResponses: true, expiresAt } });
  } else {
    await db.subscription.create({ data: { workspaceId: ws.id, userId: partner.id, plan: "pro", status: "active", leadsPerDay: 999999, sourcesLimit: 999, aiAnalysis: true, aiResponses: true, expiresAt } });
  }

  return NextResponse.json({ ok: true, expiresAt: expiresAt.toISOString() });
}
