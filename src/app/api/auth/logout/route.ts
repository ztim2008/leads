import { NextResponse } from "next/server";
import { LEADS_TOKEN_COOKIE } from "@/lib/auth/session";

export async function POST() {
  const resp = NextResponse.json({ ok: true });
  resp.cookies.set(LEADS_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
  resp.cookies.set("next-auth.session-token", "", { path: "/", maxAge: 0 });
  return resp;
}
