// Middleware — защита маршрутов по ролям
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Админские маршруты — только для роли admin
    if (path.startsWith("/dashboard/admin") || path.startsWith("/api/admin")) {
      if ((token as any)?.role !== "admin") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token }) {
        return !!token;
      },
    },
    pages: { signIn: "/auth" },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/settings",
    "/api/admin/:path*",
    "/api/worker",
    "/api/leads",
  ],
};
