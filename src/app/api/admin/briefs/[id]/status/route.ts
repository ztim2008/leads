import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBriefsUser } from "@/lib/briefs/access";
import { directologistChecks } from "@/lib/briefs/compare";
import { landingMap } from "@/lib/briefs/landing";
import { briefPercent } from "@/lib/briefs/progress";
import { seoOutline } from "@/lib/briefs/seo";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireBriefsUser();
  if (gate.error) return gate.error;
  const { id } = await ctx.params;
  const project = await db.briefProject.findUnique({
    where: { id },
    select: {
      status: true,
      niche: true,
      regionName: true,
      runs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, stage: true, stageDetail: true, startedAt: true, error: true },
      },
    },
  });
  if (!project) return NextResponse.json({ error: "Не найден" }, { status: 404 });
  const run = project.runs[0];
  const pagesMatch = /^(\d+) из (\d+)/.exec(run?.stageDetail || "");
  const percent = briefPercent({
    status: project.status,
    stage: run?.stage || null,
    pagesDone: pagesMatch ? Number(pagesMatch[1]) - 1 : undefined,
    pagesTotal: pagesMatch ? Number(pagesMatch[2]) : undefined,
  });

  let summary = null;
  if (project.status === "ready") {
    const findings = (
      await db.briefFinding.findMany({
        where: { projectId: id, section: "site" },
        orderBy: { sort: "asc" },
        select: { id: true, kind: true, title: true, body: true, evidenceUrl: true, evidenceQuote: true },
      })
    ).map((finding) => ({ ...finding }));
    const input = { niche: project.niche, regionName: project.regionName, findings };
    const rows = [...directologistChecks(input), ...seoOutline(input)];
    summary = {
      beforeLaunch: rows.filter((row) => row.tone === "bad" && row.when === "before").length,
      later: rows.filter((row) => row.tone === "bad" && row.when === "later").length,
      good: rows.filter((row) => row.tone === "good").length,
      groups: landingMap(input).length,
    };
  }

  return NextResponse.json({
    status: project.status,
    stage: run?.stage || null,
    stageDetail: run?.stageDetail || null,
    startedAt: run?.startedAt || null,
    error: run?.error || null,
    percent,
    summary,
  });
}
