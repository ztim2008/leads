import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminUser } from "@/lib/admin/guard";
import { buildAccessCard } from "@/lib/admin/access-card";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  const guard = await requireAdminUser();
  if (guard.error) return guard.error;

  const { id } = await Promise.resolve(params);
  const partner = await db.user.findUnique({
    where: { id },
    include: {
      workspaces: { include: { sources: true, settings: true } },
      subscription: true,
    },
  });

  if (!partner || partner.role === "admin") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const ws = partner.workspaces[0];
  const source = ws?.sources?.find((s) => s.platform === "profi") || ws?.sources?.[0];
  const cfg = (source?.config as Record<string, unknown>) || {};

  return NextResponse.json({
    ok: true,
    accessCard: buildAccessCard({
      partnerId: partner.id,
      email: partner.email,
      name: partner.firstName,
      sourceId: source?.id,
      sourceConfig: cfg,
      telegramChatId: ws?.settings?.telegramChatId || null,
      leadsPerMonth: partner.subscription?.leadsPerMonth ?? null,
    }),
  });
}
