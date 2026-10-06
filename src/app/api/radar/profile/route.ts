import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { clampInt, ensureRadarProfile, linesToList, RADAR_PROFILE_ID } from "@/lib/radar/profile";

export async function GET() {
  const gate = await requireAdminUser();
  if (gate.error) return gate.error;
  const profile = await ensureRadarProfile();
  return NextResponse.json({ profile });
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdminUser();
  if (gate.error) return gate.error;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const current = await ensureRadarProfile();
  const list = (value: unknown, fallback: string[]) => {
    if (typeof value === "string") return linesToList(value);
    if (Array.isArray(value)) return linesToList(value.join("\n"));
    return fallback;
  };
  const data = {
    enabled: typeof body.enabled === "boolean" ? body.enabled : current.enabled,
    alertsEnabled: typeof body.alertsEnabled === "boolean" ? body.alertsEnabled : current.alertsEnabled,
    requireSalary: typeof body.requireSalary === "boolean" ? body.requireSalary : current.requireSalary,
    remoteOnly: typeof body.remoteOnly === "boolean" ? body.remoteOnly : current.remoteOnly,
    specialization:
      typeof body.specialization === "string"
        ? body.specialization.trim().slice(0, 160) || current.specialization
        : current.specialization,
    about: typeof body.about === "string" ? body.about.trim().slice(0, 2000) : current.about,
    directions: list(body.directions, current.directions),
    skills: list(body.skills, current.skills),
    formats: list(body.formats, current.formats),
    exclusions: list(body.exclusions, current.exclusions),
    searchQueries: list(body.searchQueries, current.searchQueries),
    tildaQueries: list(body.tildaQueries, current.tildaQueries),
    aiQueries: list(body.aiQueries, current.aiQueries),
    salaryMin: body.salaryMin == null ? current.salaryMin : clampInt(body.salaryMin, 0, 1_000_000, current.salaryMin),
    matchMin: body.matchMin == null ? current.matchMin : clampInt(body.matchMin, 0, 100, current.matchMin),
    trustMin: body.trustMin == null ? current.trustMin : clampInt(body.trustMin, 0, 100, current.trustMin),
    dailyAlertCap:
      body.dailyAlertCap == null ? current.dailyAlertCap : clampInt(body.dailyAlertCap, 1, 20, current.dailyAlertCap),
    quietStart: typeof body.quietStart === "string" && /^\d{1,2}:\d{2}$/.test(body.quietStart) ? body.quietStart : current.quietStart,
    quietEnd: typeof body.quietEnd === "string" && /^\d{1,2}:\d{2}$/.test(body.quietEnd) ? body.quietEnd : current.quietEnd,
    telegramChatId:
      body.telegramChatId == null ? current.telegramChatId : String(body.telegramChatId).trim() || null,
  };
  if (!data.directions.length || !data.searchQueries.length) {
    return NextResponse.json({ error: "Нужны направления и хотя бы один поиск HH" }, { status: 400 });
  }
  const profile = await db.jobRadarProfile.update({ where: { id: RADAR_PROFILE_ID }, data });
  return NextResponse.json({ profile });
}
