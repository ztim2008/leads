import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { compare } from "bcryptjs";
import { LEADS_TOKEN_COOKIE, signLeadsToken } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const user = await db.user.findUnique({ where: { email } });
  if (!user?.passwordHash) return NextResponse.json({ error: "no password" }, { status: 401 });
  if (user.loginEnabled === false) {
    return NextResponse.json({ error: "disabled" }, { status: 403 });
  }
  const ok = await compare(password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "wrong password" }, { status: 401 });

  const token = await signLeadsToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  const resp = NextResponse.json({ ok: true, email: user.email, role: user.role, token });
  resp.cookies.set(LEADS_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
  });
  return resp;
}
