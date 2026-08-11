import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/** Merge heartbeat / CB metadata into source.config (preserves credentials). */
export async function patchSourceAgentMeta(
  sourceId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const source = await db.source.findUnique({ where: { id: sourceId } });
  if (!source) return;
  const cfg = { ...((source.config as Record<string, unknown>) || {}), ...patch };
  await db.source.update({
    where: { id: sourceId },
    data: { config: cfg as Prisma.InputJsonValue },
  });
}

export function deriveAgentLifecycle(cfg: Record<string, unknown>): string {
  const cb = cfg._circuitBreaker as { state?: string } | undefined;
  if (cb?.state === "BLOCKED") return "blocked";
  if (cb?.state === "OPEN") return "cooldown";
  if (cfg._agentState) return String(cfg._agentState);
  if (cfg._lastHeartbeat) {
    const age = Date.now() - new Date(String(cfg._lastHeartbeat)).getTime();
    if (age < 15 * 60 * 1000) return "running";
  }
  return "pending";
}
