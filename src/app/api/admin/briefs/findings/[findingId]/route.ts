import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBriefsUser } from "@/lib/briefs/access";

type Ctx = { params: Promise<{ findingId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const gate = await requireBriefsUser();
  if (gate.error) return gate.error;
  const { findingId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim().slice(0, 180);
  const text = String(body.body || "").trim().slice(0, 4000);
  if (!title || !text) {
    return NextResponse.json({ error: "Нужны заголовок и текст" }, { status: 400 });
  }
  const existing = await db.briefFinding.findUnique({ where: { id: findingId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Не найден" }, { status: 404 });
  await db.briefFinding.update({ where: { id: findingId }, data: { title, body: text } });
  return NextResponse.json({ ok: true });
}
