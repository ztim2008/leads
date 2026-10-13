import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBriefsUser } from "@/lib/briefs/access";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const gate = await requireBriefsUser();
  if (gate.error) return gate.error;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const text = String(body.body ?? "").slice(0, 8000);
  const project = await db.briefProject.findUnique({ where: { id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Не найден" }, { status: 404 });
  await db.briefDocument.upsert({
    where: { projectId: id },
    create: { projectId: id, body: text },
    update: { body: text },
  });
  return NextResponse.json({ ok: true });
}
