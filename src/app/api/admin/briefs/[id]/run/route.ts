import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBriefsUser } from "@/lib/briefs/access";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const gate = await requireBriefsUser();
  if (gate.error) return gate.error;
  const { id } = await ctx.params;
  const project = await db.briefProject.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!project) return NextResponse.json({ error: "Не найден" }, { status: 404 });
  if (project.status === "queued" || project.status === "running") {
    return NextResponse.json({ error: "Разбор уже идёт" }, { status: 409 });
  }
  await db.$transaction([
    db.briefRun.create({ data: { projectId: id, status: "queued" } }),
    db.briefProject.update({ where: { id }, data: { status: "queued" } }),
  ]);
  return NextResponse.json({ ok: true });
}
