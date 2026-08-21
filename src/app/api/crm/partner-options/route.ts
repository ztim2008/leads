import { NextResponse } from "next/server";
import { requireCrmUser } from "@/lib/crm/guard";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/auth/roles";

/** Список партнёров для связи с CRM-карточкой (только админ). */
export async function GET() {
  const gate = await requireCrmUser();
  if (gate.error) return gate.error;
  if (!gate.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const partners = await db.user.findMany({
    where: { role: ROLES.PARTNER },
    select: {
      id: true,
      email: true,
      firstName: true,
      workspaces: { select: { id: true, name: true }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    partners: partners
      .filter((p) => p.workspaces[0])
      .map((p) => ({
        partnerId: p.id,
        email: p.email,
        name: p.firstName || p.email,
        workspaceId: p.workspaces[0].id,
        workspaceName: p.workspaces[0].name,
      })),
  });
}
