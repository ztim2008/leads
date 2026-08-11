import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { LEADS_TOKEN_COOKIE, signLeadsToken, verifyLeadsToken } from "@/lib/auth/session";

/** Вернуться в аккаунт админа после «Войти как партнёр». */
export async function POST() {
  const session = await auth();
  const cookieStore = await cookies();
  const raw = cookieStore.get(LEADS_TOKEN_COOKIE)?.value;
  const payload = raw ? await verifyLeadsToken(raw) : null;

  let adminId = payload?.impersonatorId;
  let adminEmail = payload?.impersonatorEmail;

  if (!adminId && session?.user) {
    const u = await db.user.findUnique({ where: { email: (session.user as { email?: string }).email } });
    if (u?.role === "admin") {
      adminId = u.id;
      adminEmail = u.email;
    }
  }

  if (!adminId || !adminEmail) {
    return NextResponse.json({ error: "Not impersonating" }, { status: 400 });
  }

  const admin = await db.user.findUnique({ where: { id: adminId } });
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Admin not found" }, { status: 403 });
  }

  const token = await signLeadsToken({
    id: admin.id,
    email: admin.email,
    role: admin.role,
  });

  const resp = NextResponse.json({ ok: true, url: "/dashboard/admin" });
  resp.cookies.set(LEADS_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
  });
  return resp;
}
