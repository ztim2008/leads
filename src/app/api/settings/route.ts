import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import { applyPartnerFilters } from "@/lib/leads/partner-filters";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { email: (session.user as { email?: string }).email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const workspace = await db.workspace.findFirst({ where: { userId: user.id } });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const body = await req.json();
  const { workspaceId, ...fields } = body;

  if (workspaceId && workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Forbidden: wrong workspace" }, { status: 403 });
  }

  if (user.role !== "admin") {
    const filters = await applyPartnerFilters(workspace.id, {
      titleKeywords: fields.titleKeywords,
      titleMinusKeywords: fields.titleMinusKeywords,
      keywords: fields.keywords,
      minusKeywords: fields.minusKeywords,
      budgetMin: fields.budgetMin,
      budgetMax: fields.budgetMax,
      showNoBudget: fields.showNoBudget,
      workHoursStart: fields.workHoursStart,
      workHoursEnd: fields.workHoursEnd,
      clientGender: fields.clientGender,
    });
    return NextResponse.json({ ok: true, filters });
  }

  await db.settings.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, ...fields },
    update: fields,
  });

  return NextResponse.json({ ok: true });
}
