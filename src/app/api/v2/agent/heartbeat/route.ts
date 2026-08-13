import { db } from "@/lib/db";
import { agentUnauthorized, verifyAgentSecret } from "@/lib/agent/auth";
import { deriveAgentLifecycle, patchSourceAgentMeta } from "@/lib/agent/source-config";
import { isActiveAgentError } from "@/lib/agent/stale-error";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { secret, sourceId, status } = body;

    if (!verifyAgentSecret(secret)) return agentUnauthorized();

    const cbState = status?.circuitBreaker?.state || "";
    const lastError = String(status?.lastError || "").trim();
    const lastErrorTime = status?.lastErrorTime || null;
    const lastLoginAt = status?.lastLoginAt || null;
    const errorActive = isActiveAgentError({
      lastError,
      lastErrorTime,
      circuitBreakerState: cbState,
      lastLoginAt,
      leadsCollected: status?.leads || 0,
    });

    const lifecycle =
      status?.agentState ||
      (cbState === "OPEN"
        ? "cooldown"
        : cbState === "BLOCKED"
          ? "blocked"
          : "running");

    await db.source.update({
      where: { id: sourceId },
      data: {
        lastCheckAt: new Date(),
        status: errorActive || cbState === "OPEN" || cbState === "BLOCKED" ? "error" : "ok",
        lastError: errorActive ? lastError : null,
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
        ...(lastLoginAt ? { _lastLoginAt: lastLoginAt } : {}),
        ...(errorActive
          ? { _lastError: lastError, _lastErrorTime: lastErrorTime || new Date().toISOString() }
          : { _lastError: null, _lastErrorArchived: lastError || null, _lastErrorTime: lastErrorTime || null }),
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
