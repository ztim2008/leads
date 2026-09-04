import { auth } from "@/lib/auth/auth";
import { canAccessIdeas } from "@/lib/ideas/access";
import { isAdminRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function requireIdeasUser() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const email = (session.user as { email?: string }).email || "";
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.loginEnabled === false) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const ok = await canAccessIdeas(user.email, user.role);
  if (!ok) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, isAdmin: isAdminRole(user.role) };
}
