// POST /api/agent/heartbeat — агент шлёт статус каждые 5 мин
// { secret, sourceId, status: { leads, errors, uptime, memory } }

import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const AGENT_SECRET = process.env.AGENT_SECRET || "leads-agent-secret-2026";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { secret, sourceId, status } = body;

    if (secret !== AGENT_SECRET) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Обновляем source статус
    await db.source.update({
      where: { id: sourceId },
      data: {
        lastCheckAt: new Date(),
        status: status?.error ? "error" : "ok",
      },
    });

    // Логируем heartbeats в config для мониторинга
    if (status) {
      const source = await db.source.findUnique({ where: { id: sourceId } });
      if (source) {
        const cfg = (source.config as any) || {};
        cfg._lastHeartbeat = new Date().toISOString();
        cfg._agentUptime = status.uptime || 0;
        cfg._agentMemory = status.memory || 0;
        cfg._agentLeads = status.leads || 0;
        cfg._agentErrors = status.errors || 0;
        await db.source.update({
          where: { id: sourceId },
          data: { config: cfg },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[agent/heartbeat]", e.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
