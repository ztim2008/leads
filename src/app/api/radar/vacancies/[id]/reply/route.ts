import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { draftReply, radarApiKey } from "@/lib/radar/ai";
import { ensureRadarProfile } from "@/lib/radar/profile";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminUser();
  if (gate.error) return gate.error;
  const { id } = await ctx.params;
  const vacancy = await db.jobVacancy.findUnique({ where: { id } });
  if (!vacancy) return NextResponse.json({ error: "Вакансия не найдена" }, { status: 404 });
  const apiKey = radarApiKey();
  if (!apiKey) return NextResponse.json({ error: "Нет ключа OpenRouter" }, { status: 400 });
  const profile = await ensureRadarProfile();
  try {
    const text = await draftReply({
      apiKey,
      specialization: profile.specialization,
      about: profile.about,
      directions: profile.directions,
      skills: profile.skills,
      title: vacancy.title,
      company: vacancy.company,
      description: vacancy.description,
    });
    if (!text) return NextResponse.json({ error: "Пустой ответ модели" }, { status: 502 });
    await db.jobVacancy.update({ where: { id }, data: { replyDraft: text } });
    return NextResponse.json({ text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось подготовить отклик";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
