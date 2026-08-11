import { db } from "@/lib/db";
import { agentUnauthorized, verifyAgentSecret } from "@/lib/agent/auth";
import { patchSourceAgentMeta } from "@/lib/agent/source-config";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID || "778784292";
const ADMIN_BOT = process.env.TELEGRAM_BOT_TOKEN || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { secret, sourceId, type, message, circuitBreaker } = body;

    if (!verifyAgentSecret(secret)) return agentUnauthorized();

    const source = await db.source.findUnique({ where: { id: sourceId } });
    const cfg = (source?.config as Record<string, unknown>) || {};
    const login = cfg.login || sourceId?.slice(0, 8);

    await patchSourceAgentMeta(sourceId, {
      _lastAlert: new Date().toISOString(),
      _lastAlertType: type,
      _circuitBreaker: circuitBreaker || cfg._circuitBreaker,
    });

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

    if (ADMIN_BOT && ADMIN_CHAT) {
      await fetch(`https://api.telegram.org/bot${ADMIN_BOT}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: ADMIN_CHAT, text }),
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
