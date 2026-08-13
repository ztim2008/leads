import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function requireAdminUser() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const email = (session.user as { email?: string }).email || "";
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}
