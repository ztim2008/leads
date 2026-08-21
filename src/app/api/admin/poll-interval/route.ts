import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import {
  isPollPresetId,
  pollConfigPatch,
  POLL_PRESETS,
  resolvePollRange,
} from "@/lib/agent/poll-interval";
import type { Prisma } from "@prisma/client";

/** GET — пресеты + текущий интервал источника */
export async function GET(req: NextRequest) {
  const gate = await requireAdminUser();
  if (gate.error) return gate.error;

  const sourceId = req.nextUrl.searchParams.get("sourceId");
  if (!sourceId) {
    return NextResponse.json({
      presets: Object.values(POLL_PRESETS),
      absoluteMin: 2,
      docs: "/docs/PROFI_POLL_LOGISTICS.md",
    });
  }

  const source = await db.source.findUnique({ where: { id: sourceId } });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const cfg = (source.config as Record<string, unknown>) || {};
  return NextResponse.json({
    presets: Object.values(POLL_PRESETS),
    current: resolvePollRange(cfg),
    sourceId: source.id,
  });
}

/** PATCH — сменить пресет интервала (только админ). Без рестарта VPS. */
export async function PATCH(req: NextRequest) {
  const gate = await requireAdminUser();
  if (gate.error) return gate.error;

  const body = await req.json().catch(() => ({}));
  const sourceId = String(body.sourceId || "");
  const preset = body.preset;
  if (!sourceId || !isPollPresetId(preset)) {
    return NextResponse.json(
      { error: "Нужны sourceId и preset: calm | standard | responsive" },
      { status: 400 },
    );
  }

  const source = await db.source.findUnique({ where: { id: sourceId } });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cfg = { ...((source.config as Record<string, unknown>) || {}) };
  Object.assign(cfg, pollConfigPatch(preset));

  await db.source.update({
    where: { id: sourceId },
    data: { config: cfg as Prisma.InputJsonValue },
  });

  const poll = resolvePollRange(cfg);
  return NextResponse.json({
    ok: true,
    poll,
    note: "Агент подхватит за ~2 мин (config refresh). Рестарт VPS не нужен.",
  });
}
