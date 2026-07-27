import { db } from "@/lib/db";
import { sendLeadNotification } from "@/lib/telegram/notifications";
import { writeFileSync } from "fs";
import { join } from "path";

const STATUS_FILE = join(process.cwd(), ".collector-status.json");

export async function saveAndNotify(lead: any, source: any, s: any, responseText?: string) {
  const extId = lead.externalId || source.platform + "-" + Date.now();
  const saved = await db.lead.upsert({
    where: { externalId: extId },
    create: {
      workspaceId: source.workspaceId, sourceId: source.id,
      externalId: extId, title: lead.title, description: lead.description,
      budgetMin: lead.budgetMin, budgetMax: lead.budgetMax,
      url: lead.url, createdAt: new Date(lead.createdAt || Date.now()),
    },
    update: {},
  });
  if (s?.telegramChatId && s?.telegramToken && s?.telegramAlerts !== false) {
    sendLeadNotification(s.telegramChatId, {
      platform: source.platform, platformColor: source.color || "#22c55e", score: 0,
      title: lead.title || "", budget: lead.budgetMin ? lead.budgetMin + " RUB" : "no budget",
      url: lead.url || "", reasoning: (lead.description || "").slice(0, 250),
      descriptionLength: (lead.description || "").length,
      responseText: responseText || undefined,
    }, s.telegramToken).catch(() => {});
  }
  return saved;
}

export function saveStatus(info: any) {
  try { writeFileSync(STATUS_FILE, JSON.stringify({ ...info, updatedAt: new Date().toISOString() })); } catch {}
}

export function mskNow() { return new Date(Date.now() + 3 * 60 * 60 * 1000); }
