import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBriefsUser } from "@/lib/briefs/access";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireBriefsUser();
  if (gate.error) return gate.error;
  const { id } = await ctx.params;
  const project = await db.briefProject.findUnique({
    where: { id },
    include: {
      findings: { orderBy: { sort: "asc" } },
      document: true,
      runs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!project) return NextResponse.json({ error: "Не найден" }, { status: 404 });
  return NextResponse.json({ project });
}
