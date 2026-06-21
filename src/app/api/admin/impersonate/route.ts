import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { partnerEmail } = await req.json();
  if (!partnerEmail) return NextResponse.json({ error: "partnerEmail required" }, { status: 400 });

  const partner = await db.user.findUnique({ where: { email: partnerEmail } });
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  return NextResponse.json({ ok: true, email: partner.email });
}
