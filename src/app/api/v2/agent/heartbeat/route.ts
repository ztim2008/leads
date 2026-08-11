import { db } from "@/lib/db";
import { agentUnauthorized, verifyAgentSecret } from "@/lib/agent/auth";
import { deriveAgentLifecycle, patchSourceAgentMeta } from "@/lib/agent/source-config";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { secret, sourceId, status } = body;

    if (!verifyAgentSecret(secret)) return agentUnauthorized();

    const lifecycle =
      status?.agentState ||
      (status?.circuitBreaker?.state === "OPEN"
        ? "cooldown"
        : status?.circuitBreaker?.state === "BLOCKED"
          ? "blocked"
          : "running");

    await db.source.update({
      where: { id: sourceId },
      data: {
        lastCheckAt: new Date(),
        status: status?.lastError || status?.circuitBreaker?.state === "OPEN" ? "error" : "ok",
        lastError: status?.lastError || status?.circuitBreaker?.lastReason || null,
      },
    });

    if (status) {
      await patchSourceAgentMeta(sourceId, {
        _lastHeartbeat: new Date().toISOString(),
        _agentUptime: status.uptime || 0,
        _agentMemory: status.memory || 0,
        _agentLeads: status.leads || 0,
        _agentErrors: status.errors || 0,
        _agentState: lifecycle,
        _circuitBreaker: status.circuitBreaker || null,
        _agentVersion: 2,
        ...(status.lastError
          ? { _lastError: status.lastError, _lastErrorTime: status.lastErrorTime || new Date().toISOString() }
          : {}),
      });
    }

    const source = await db.source.findUnique({ where: { id: sourceId } });
    const cfg = (source?.config as Record<string, unknown>) || {};

    return NextResponse.json({
      ok: true,
      lifecycle: deriveAgentLifecycle(cfg),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[v2/agent/heartbeat]", msg);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
