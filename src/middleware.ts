import { NextRequest, NextResponse } from "next/server";
import { LEADS_TOKEN_COOKIE, verifyLeadsToken } from "@/lib/auth/session";

export default async function middleware(req: NextRequest) {
  const token = req.cookies.get(LEADS_TOKEN_COOKIE)?.value;
  const path = req.nextUrl.pathname;

  if (!token) {
    if (path.startsWith("/dashboard") || path.startsWith("/api/admin")) {
      return NextResponse.redirect(new URL("/auth", req.url));
    }
    return NextResponse.next();
  }

  const payload = await verifyLeadsToken(token);
  if (!payload) {
    const resp = NextResponse.redirect(new URL("/auth", req.url));
    resp.cookies.set(LEADS_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
    return resp;
  }

  const isAdminRoute = path.startsWith("/dashboard/admin") || path.startsWith("/api/admin");
  const isAdmin = payload.role === "admin" && !payload.impersonatorId;

  if (isAdminRoute && !isAdmin) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Админ — оператор, не сборщик. Свои заявки только через impersonation / партнёра.
  const partnerUi = [
    "/dashboard/leads",
    "/dashboard/sources",
    "/dashboard/settings",
    "/dashboard/analytics",
    "/dashboard/billing",
  ];
  if (isAdmin && (path === "/dashboard" || partnerUi.some((p) => path === p || path.startsWith(p + "/")))) {
    return NextResponse.redirect(new URL("/dashboard/admin/ops", req.url));
  }

  // Партнёр не настраивает источники
  if (payload.role !== "admin" && path.startsWith("/dashboard/sources")) {
    return NextResponse.redirect(new URL("/dashboard/leads", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/admin/:path*"],
};
