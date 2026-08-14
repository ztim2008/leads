// POST /api/agent/leads — приём заявок от агентов на VPS партнёров
// Агент шлёт: { secret, sourceId, leads: [...] }

import { db } from "@/lib/db";
import { sendTrackedLeadNotification } from "@/lib/telegram/delivery";
import { matchedKeyword, parseFeedCard } from "@/lib/leads/parse-feed-card";
import { assertCollectionAllowed, recordNewLead } from "@/lib/billing/quota";
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

    const quota = await assertCollectionAllowed(source.workspaceId);
    if (!quota.allowed) {
      return NextResponse.json({ ok: false, saved: 0, skipped: leads?.length || 0, quotaExceeded: true, reason: quota.reason });
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

      const leadQuota = await assertCollectionAllowed(source.workspaceId);
      if (!leadQuota.allowed) { skipped++; continue; }

      // Сохраняем
      const savedLead = await db.lead.create({
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

      await recordNewLead(source.workspaceId);

      if (settings?.telegramChatId && settings?.telegramToken && settings?.telegramAlerts !== false) {
        const parsed = parseFeedCard(String(lead.description || ""), String(lead.title || ""));
        const blob = `${lead.title || ""} ${lead.description || ""}`;
        sendTrackedLeadNotification({
          workspaceId: source.workspaceId,
          sourceId: source.id,
          leadId: savedLead.id,
          chatId: settings.telegramChatId,
          botToken: settings.telegramToken,
          lead: {
            platform: source.platform,
            title: lead.title || "",
            budget: parsed.budgetLabel || (lead.budgetMin ? Number(lead.budgetMin).toLocaleString("ru-RU") + " ₽" : "не указан"),
            url: lead.url || "",
            city: lead.city || parsed.city,
            remote: parsed.remote,
            responses: parsed.responses,
            responsePrice: lead.responsePrice || parsed.responsePrice,
            ageLabel: parsed.ageLabel,
            matchedKeyword: matchedKeyword(blob, settings.keywords),
            clientHint: parsed.clientHint,
            taskSnippet: parsed.taskSnippet,
            author: lead.author || parsed.author,
            reviewCount: lead.reviewCount ?? parsed.reviewCount,
            newbie: parsed.newbie,
            riskHint: parsed.riskHint,
          },
        }).catch(() => {});
      }

      saved++;
    }

    return NextResponse.json({ ok: true, saved, skipped });
  } catch (e: any) {
    console.error("[agent/leads]", e.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
