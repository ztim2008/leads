import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { matchIntent, HELP_TEXT } from "@/lib/assistant/intents";
import { llmIntent, isLlmConfigured } from "@/lib/assistant/llm";
import { executeAction, buildPendingAction } from "@/lib/assistant/execute";
import type { AssistantActionType, IntentMatch } from "@/lib/assistant/types";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const user = await db.user.findUnique({ where: { email: (session.user as { email?: string }).email } });
  if (!user || user.role !== "admin") return null;
  return user;
}

function mergeIntent(rule: IntentMatch, llm: IntentMatch | null): IntentMatch {
  if (!llm || llm.confidence < rule.confidence) return rule;
  if (rule.confidence >= 0.85) return rule;
  return llm;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({
    llmConfigured: isLlmConfigured(),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { message, confirm } = body as {
    message?: string;
    confirm?: { type: AssistantActionType; params: Record<string, string | number | boolean> };
  };

  if (confirm?.type) {
    const result = await executeAction(confirm.type, confirm.params || {});
    return NextResponse.json({
      reply: result.message,
      ok: result.ok,
    });
  }

  if (!message?.trim()) {
    return NextResponse.json({ reply: HELP_TEXT });
  }

  const ruleIntent = matchIntent(message);
  const llm = isLlmConfigured() ? await llmIntent(message) : null;
  const intent = mergeIntent(ruleIntent, llm);
  let llmUsed = false;
  if (llm && llm.confidence > ruleIntent.confidence) {
    llmUsed = true;
  }

  if (intent.type === "help") {
    return NextResponse.json({ reply: HELP_TEXT, llmUsed });
  }

  if (intent.type === "vps_hint") {
    const ip = String(intent.params.vpsIp || "");
    const host = String(intent.params.hostname || "");
    return NextResponse.json({
      reply: [
        `Распознан VPS: ${host || "—"}, IP: ${ip || "—"}`,
        "Укажите email партнёра в том же сообщении — сохраню IP.",
        "Пароль SSH не сохраняется. Дальше: SSH → curl install.sh (команда «команда vps email@…»).",
      ].join("\n"),
      hints: { vpsIp: ip, hostname: host },
      llmUsed,
    });
  }

  if (intent.type === "unknown") {
    return NextResponse.json({
      reply: `Не понял команду. ${HELP_TEXT}`,
      llmUsed,
    });
  }

  const readOnly: AssistantActionType[] = ["list_partners", "partner_status", "get_install_command"];
  if (readOnly.includes(intent.type as AssistantActionType)) {
    const result = await executeAction(intent.type as AssistantActionType, intent.params);
    return NextResponse.json({ reply: result.message, ok: result.ok, llmUsed });
  }

  const pending = buildPendingAction(intent.type as AssistantActionType, intent.params);
  if (!pending) {
    const result = await executeAction(intent.type as AssistantActionType, intent.params);
    return NextResponse.json({ reply: result.message, ok: result.ok, llmUsed });
  }

  if (pending.type === "create_partner" && pending.missing && pending.missing.length > 0) {
    return NextResponse.json({
      reply: [
        `Создание партнёра — не хватает: ${pending.missing.join(", ")}.`,
        "Откройте форму «+ Подключить» или допишите в чате:",
        "email, пароль входа, profiLogin, profiPassword, лимит.",
        pending.params.email ? `Email уже распознан: ${pending.params.email}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      pendingAction: pending,
      llmUsed,
    });
  }

  return NextResponse.json({
    reply: `Подтвердите действие: ${pending.label}`,
    pendingAction: pending,
    llmUsed,
  });
}
