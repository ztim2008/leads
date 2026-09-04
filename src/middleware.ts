import { NextRequest, NextResponse } from "next/server";
import { LEADS_TOKEN_COOKIE, verifyLeadsToken } from "@/lib/auth/session";
import { homePathForRole, isAdminRole, isSalesRole, canAccessCrm } from "@/lib/auth/roles";

export default async function middleware(req: NextRequest) {
  const token = req.cookies.get(LEADS_TOKEN_COOKIE)?.value;
  const path = req.nextUrl.pathname;

  if (!token) {
    if (
      path.startsWith("/dashboard") ||
      path.startsWith("/api/admin") ||
      path.startsWith("/api/crm") ||
      path.startsWith("/api/ideas")
    ) {
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

  const isAdmin = isAdminRole(payload.role) && !payload.impersonatorId;
  const isSales = isSalesRole(payload.role);
  const isAdminRoute = path.startsWith("/dashboard/admin") || path.startsWith("/api/admin");
  const isCrmRoute = path.startsWith("/dashboard/crm") || path.startsWith("/api/crm");
  const isIdeasRoute = path.startsWith("/dashboard/ideas") || path.startsWith("/api/ideas");

  if (isAdminRoute && !isAdmin) {
    return NextResponse.redirect(new URL(homePathForRole(payload.role), req.url));
  }

  if (isCrmRoute && !canAccessCrm(payload.role)) {
    return NextResponse.redirect(new URL(homePathForRole(payload.role), req.url));
  }

  // Ideas: whitelist проверяется на странице/API (DB). Здесь — только не редиректить админа/sales с пути.
  // (полный canAccessIdeas — в page + requireIdeasUser)

  // Напарник — только CRM (+ Ideas если whitelist на уровне page), не кабинет партнёра
  if (isSales) {
    const partnerUi = [
      "/dashboard/leads",
      "/dashboard/sources",
      "/dashboard/settings",
      "/dashboard/analytics",
      "/dashboard/billing",
    ];
    if (
      !isIdeasRoute &&
      (path === "/dashboard" ||
        partnerUi.some((p) => path === p || path.startsWith(p + "/")))
    ) {
      return NextResponse.redirect(new URL("/dashboard/crm", req.url));
    }
  }

  // Админ — оператор, не сборщик (Ideas Board — исключение: админ всегда может открыть)
  const partnerUi = [
    "/dashboard/leads",
    "/dashboard/sources",
    "/dashboard/settings",
    "/dashboard/analytics",
    "/dashboard/billing",
  ];
  if (
    isAdmin &&
    !isIdeasRoute &&
    (path === "/dashboard" || partnerUi.some((p) => path === p || path.startsWith(p + "/")))
  ) {
    return NextResponse.redirect(new URL("/dashboard/admin/ops", req.url));
  }

  if (payload.role !== "admin" && path.startsWith("/dashboard/sources")) {
    return NextResponse.redirect(new URL(homePathForRole(payload.role), req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/admin/:path*", "/api/crm/:path*", "/api/ideas/:path*"],
};
