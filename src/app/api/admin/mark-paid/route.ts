import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import { renewPartnerMonth } from "@/lib/billing/quota";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: (session.user as { email?: string }).email } });
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email } = await req.json();
  const partner = await db.user.findUnique({ where: { email } });
  if (!partner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ws = await db.workspace.findFirst({ where: { userId: partner.id } });
  if (!ws) return NextResponse.json({ error: "No workspace" }, { status: 404 });

  const updated = await renewPartnerMonth(ws.id);
  return NextResponse.json({
    ok: true,
    expiresAt: updated.expiresAt?.toISOString(),
    leadsPerMonth: updated.leadsPerMonth,
    leadsUsedMonth: updated.leadsUsedMonth,
  });
}
