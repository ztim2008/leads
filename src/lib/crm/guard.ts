import { auth } from "@/lib/auth/auth";
import { canAccessCrm, isAdminRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function requireCrmUser() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const email = (session.user as { email?: string }).email || "";
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !canAccessCrm(user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (user.loginEnabled === false) {
    return { error: NextResponse.json({ error: "Account disabled" }, { status: 403 }) };
  }
  return { user, isAdmin: isAdminRole(user.role) };
}

/** Напарник видит/меняет только карточки, где ownerId = он. Админ — все. */
export function crmOwnerScope(userId: string, isAdmin: boolean): { ownerId?: string } {
  if (isAdmin) return {};
  return { ownerId: userId };
}

export function assertOwnsClient(
  client: { ownerId: string | null },
  userId: string,
  isAdmin: boolean,
): NextResponse | null {
  if (isAdmin) return null;
  if (client.ownerId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}
