import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { compare } from "bcryptjs";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const user = await db.user.findUnique({ where: { email } });
  if (!user?.passwordHash) return NextResponse.json({ error: "no pass" }, { status: 401 });
  const ok = await compare(password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "wrong pass" }, { status: 401 });
  return NextResponse.json({ ok: true, email: user.email, role: user.role });
}
