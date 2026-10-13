import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBriefsUser } from "@/lib/briefs/access";
import { assertPublicUrl } from "@/lib/briefs/fetch-site";

function normalizeSite(raw: string): string {
  const trimmed = raw.trim();
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return assertPublicUrl(withProto).toString();
}

export async function GET() {
  const gate = await requireBriefsUser();
  if (gate.error) return gate.error;
  const projects = await db.briefProject.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      siteUrl: true,
      regionName: true,
      niche: true,
      goal: true,
      status: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const gate = await requireBriefsUser();
  if (gate.error) return gate.error;
  const body = await req.json().catch(() => ({}));
  const regionName = String(body.regionName || "").trim().slice(0, 120);
  const niche = String(body.niche || "").trim().slice(0, 160);
  const goal = String(body.goal || "").trim().slice(0, 1000);
  if (!regionName || !niche || !goal) {
    return NextResponse.json({ error: "Нужны регион, ниша и цель" }, { status: 400 });
  }
  let siteUrl = "";
  try {
    siteUrl = normalizeSite(String(body.siteUrl || ""));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Адрес сайта не подходит" },
      { status: 400 },
    );
  }

  const project = await db.briefProject.create({
    data: {
      siteUrl,
      regionName,
      niche,
      goal,
      status: "queued",
      createdById: gate.actor.id,
      document: { create: { body: "" } },
      runs: { create: { status: "queued" } },
    },
    select: { id: true },
  });
  return NextResponse.json({ id: project.id });
}
