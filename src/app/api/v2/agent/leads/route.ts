import { db } from "@/lib/db";
import { saveAndNotify } from "@/collectors/shared";
import { agentUnauthorized, verifyAgentSecret } from "@/lib/agent/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { secret, sourceId, leads } = body;

    if (!verifyAgentSecret(secret)) return agentUnauthorized();

    const source = await db.source.findUnique({
      where: { id: sourceId },
      include: { workspace: { include: { settings: true } } },
    });

    if (!source || !source.enabled) {
      return NextResponse.json({ error: "source not found or disabled" }, { status: 404 });
    }

    const settings = source.workspace.settings;
    const cfg = (source.config as Record<string, unknown>) || {};
    const sWithCfg = { ...settings, config: cfg };
    const sourceMeta = {
      id: source.id,
      workspaceId: source.workspaceId,
      platform: source.platform,
      color: source.color || "#22c55e",
    };

    let saved = 0;
    let skipped = 0;

    for (const lead of leads || []) {
      const result = await saveAndNotify(lead, sourceMeta, sWithCfg);
      if (result) saved++;
      else skipped++;
    }

    return NextResponse.json({ ok: true, saved, skipped, version: 2 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[v2/agent/leads]", msg);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
