import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "981enFOks++AvBhamoSqvoDPxzCIy8sVKuoZSTjHexQ=");

export default async function middleware(req: NextRequest) {
  const token = req.cookies.get("leads_token")?.value;
  if (!token) {
    if (req.nextUrl.pathname.startsWith("/dashboard") || req.nextUrl.pathname.startsWith("/api/admin")) {
      return NextResponse.redirect(new URL("/auth", req.url));
    }
    return NextResponse.next();
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const path = req.nextUrl.pathname;
    if ((path.startsWith("/dashboard/admin") || path.startsWith("/api/admin")) && payload.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  } catch {
    const resp = NextResponse.redirect(new URL("/auth", req.url));
    resp.cookies.delete("leads_token");
    return resp;
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/admin/:path*"],
};
