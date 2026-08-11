import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { LEADS_TOKEN_COOKIE, signLeadsToken } from "@/lib/auth/session";

/** Просмотр дашборда партнёра (только для admin). Сохраняет impersonator в JWT. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await db.user.findUnique({ where: { email: (session.user as { email?: string }).email } });
  if (!admin || admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email } = await req.json();
  const target = await db.user.findUnique({ where: { email } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const token = await signLeadsToken({
    id: target.id,
    email: target.email,
    role: target.role,
    impersonatorId: admin.id,
    impersonatorEmail: admin.email,
  });

  const resp = NextResponse.json({
    ok: true,
    url: "/dashboard",
    as: target.email,
  });
  resp.cookies.set(LEADS_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  });
  return resp;
}
