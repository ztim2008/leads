import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { compare } from "bcryptjs";
import { SignJWT } from "jose";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "981enFOks++AvBhamoSqvoDPxzCIy8sVKuoZSTjHexQ=");

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const user = await db.user.findUnique({ where: { email } });
  if (!user?.passwordHash) return NextResponse.json({ error: "no password" }, { status: 401 });
  const ok = await compare(password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "wrong password" }, { status: 401 });

  const token = await new SignJWT({ id: user.id, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(SECRET);

  const resp = NextResponse.json({ ok: true, email: user.email });
  resp.cookies.set("leads_token", token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 86400,
  });
  return resp;
}
