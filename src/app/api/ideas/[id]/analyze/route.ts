import { NextRequest, NextResponse } from "next/server";
import { requireIdeasUser } from "@/lib/ideas/guard";
import { runIdeaAnalysis } from "@/lib/ideas/analyze";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/ideas/[id]/analyze
 * Требует доступ к Ideas. body: { force?: boolean, extraContext?: string }
 * Admin может всегда force; любой с доступом — тоже (пересборка анализа).
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requireIdeasUser();
  if (gate.error) return gate.error;

  const { id } = await ctx.params;
  const idea = await db.idea.findUnique({ where: { id } });
  if (!idea) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const force = Boolean(body.force) || Boolean(body.reanalyze);
  const extraContext =
    typeof body.extraContext === "string" ? body.extraContext.trim().slice(0, 2500) : undefined;

  // Уже есть анализ и не force — вернуть кэш
  if (idea.analysis && !force) {
    return NextResponse.json({
      ok: true,
      fromCache: true,
      analysis: idea.analysis,
      analyzedAt: idea.analyzedAt?.toISOString() ?? null,
      status: idea.status,
    });
  }

  try {
    const { analysis, fromCache } = await runIdeaAnalysis(id, { force: true, extraContext });
    const updated = await db.idea.findUnique({ where: { id } });
    return NextResponse.json({
      ok: true,
      fromCache,
      analysis,
      analyzedAt: updated?.analyzedAt?.toISOString() ?? null,
      status: updated?.status ?? "ready",
      source: analysis.source,
      error: analysis.error ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "IDEA_NOT_FOUND") {
      return NextResponse.json({ error: "Не найдено" }, { status: 404 });
    }
    console.error("[api/ideas/analyze]", msg);
    // Попытка откатить статус с analyzing, если застряли
    try {
      await db.idea.update({
        where: { id },
        data: { status: idea.analysis ? "ready" : "draft" },
      });
    } catch {
      /* ignore */
    }
    return NextResponse.json({ error: "Не удалось выполнить анализ" }, { status: 500 });
  }
}
