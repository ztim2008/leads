import { db } from "@/lib/db";
import { agentUnauthorized, verifyAgentSecret } from "@/lib/agent/auth";
import { patchSourceAgentMeta } from "@/lib/agent/source-config";
import { resolveAdminChannel } from "@/lib/telegram/admin-channel";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { secret, sourceId, type, message, circuitBreaker } = body;

    if (!verifyAgentSecret(secret)) return agentUnauthorized();

    const source = await db.source.findUnique({
      where: { id: sourceId },
      include: { workspace: { select: { name: true } } },
    });
    const cfg = (source?.config as Record<string, unknown>) || {};
    const login =
      source?.platform === "youdo"
        ? `YouDo · ${source.workspace.name}`
        : cfg.login || sourceId?.slice(0, 8);

    const dedupMs = type === "login_failed" ? 4 * 60 * 60 * 1000 : 15 * 60 * 1000;
    const lastAt = cfg._lastAlert ? new Date(String(cfg._lastAlert)).getTime() : 0;
    const sameType = cfg._lastAlertType === type;
    const skipTelegram = sameType && lastAt && Date.now() - lastAt < dedupMs;

    await patchSourceAgentMeta(sourceId, {
      _lastAlert: new Date().toISOString(),
      _lastAlertType: type,
      _circuitBreaker: circuitBreaker || cfg._circuitBreaker,
    });

    if (skipTelegram) {
      console.warn("[v2/agent/alert] dedup", login, type);
      return NextResponse.json({ ok: true, deduped: true });
    }

    const text = [
      `🔴 Agent v2 alert`,
      `Source: ${login}`,
      `Type: ${type}`,
      message || "",
      circuitBreaker?.state ? `CB: ${circuitBreaker.state}` : "",
      circuitBreaker?.openUntil
        ? `До: ${new Date(circuitBreaker.openUntil).toLocaleString("ru-RU")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const admin = await resolveAdminChannel();
    if (admin.token && admin.chat) {
      await fetch(`https://api.telegram.org/bot${admin.token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: admin.chat, text }),
      }).catch(() => {});
    }

    console.warn("[v2/agent/alert]", login, type, message);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[v2/agent/alert]", msg);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
