// POST /api/agent/leads — приём заявок от агентов на VPS партнёров
// Агент шлёт: { secret, sourceId, leads: [...] }

import { db } from "@/lib/db";
import { sendLeadNotification } from "@/lib/telegram/notifications";
import { NextRequest, NextResponse } from "next/server";

const AGENT_SECRET = process.env.AGENT_SECRET || "leads-agent-secret-2026";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { secret, sourceId, leads } = body;

    if (secret !== AGENT_SECRET) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const source = await db.source.findUnique({
      where: { id: sourceId },
      include: { workspace: { include: { settings: true } } },
    });

    if (!source || !source.enabled) {
      return NextResponse.json({ error: "source not found or disabled" }, { status: 404 });
    }

    const settings = source.workspace.settings;
    let saved = 0;
    let skipped = 0;

    for (const lead of leads) {
      const extId = lead.externalId;
      if (!extId) { skipped++; continue; }

      // Проверка дубля
      const exists = await db.lead.findUnique({ where: { externalId: extId } });
      if (exists) { skipped++; continue; }

      // Сохраняем
      await db.lead.create({
        data: {
          workspaceId: source.workspaceId,
          sourceId: source.id,
          externalId: extId,
          title: lead.title || "",
          description: lead.description || "",
          budgetMin: lead.budgetMin || null,
          budgetMax: lead.budgetMax || null,
          url: lead.url || "",
          createdAt: new Date(lead.createdAt || Date.now()),
        },
      });

      // Telegram-уведомление
      if (settings?.telegramChatId && settings?.telegramToken && settings?.telegramAlerts !== false) {
        const budgetStr = lead.budgetMin
          ? Number(lead.budgetMin).toLocaleString("ru-RU") + " ₽"
          : "не указан";

        sendLeadNotification(settings.telegramChatId, {
          platform: source.platform,
          platformColor: source.color || "#22c55e",
          score: 0,
          title: lead.title || "",
          budget: budgetStr,
          url: lead.url || "",
          reasoning: (lead.description || "").slice(0, 250),
          descriptionLength: (lead.description || "").length,
          responsePrice: lead.responsePrice || 0,
        }, settings.telegramToken).catch(() => {});
      }

      saved++;
    }

    return NextResponse.json({ ok: true, saved, skipped });
  } catch (e: any) {
    console.error("[agent/leads]", e.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
