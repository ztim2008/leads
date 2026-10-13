import { NextResponse } from "next/server";
import { requireBriefsUser } from "@/lib/briefs/access";
import { db } from "@/lib/db";
import { companyName, type PresentFinding } from "@/lib/briefs/present";
import { renderBriefPdf } from "@/lib/briefs/pdf";
import { briefPdfDocument, type PdfAudience } from "@/lib/briefs/reading";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const gate = await requireBriefsUser();
  if (gate.error) return gate.error;
  const { id } = await ctx.params;
  const audience: PdfAudience = new URL(req.url).searchParams.get("for") === "client" ? "client" : "team";
  const project = await db.briefProject.findUnique({
    where: { id },
    include: { findings: { orderBy: { sort: "asc" } }, document: true },
  });
  if (!project) return NextResponse.json({ error: "Не найден" }, { status: 404 });

  const site = project.findings.filter((finding) => finding.section === "site").map(toPresent);
  const semantics = project.findings.filter((finding) => finding.section === "semantics").map(toPresent);
  const host = hostOf(project.siteUrl);
  const pdf = await renderBriefPdf(
    briefPdfDocument({
      company: companyName(site, host),
      siteUrl: project.siteUrl,
      niche: project.niche,
      regionName: project.regionName,
      goal: project.goal,
      findings: site,
      semantics,
      notes: project.document?.body || "",
      audience,
    }),
  );
  const filename = `strateg-${host.replace(/[^a-z0-9.-]+/gi, "-")}${audience === "client" ? "-client" : ""}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function toPresent(finding: {
  id: string;
  kind: string;
  title: string;
  body: string;
  evidenceUrl: string | null;
  evidenceQuote: string | null;
}): PresentFinding {
  return finding;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "brief";
  }
}
