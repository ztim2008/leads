import { db } from "@/lib/db";
import { sendLeadNotification } from "@/lib/telegram/notifications";
import { extractBudget } from "@/lib/connectors/profi";
import { writeFileSync } from "fs";
import { join } from "path";

const STATUS_FILE = join(process.cwd(), ".collector-status.json");

function fmtBudget(n: number | null | undefined): string {
  if (!n) return "";
  return n.toLocaleString("ru-RU").replace(/\u00A0/g, " ") + " ₽";
}

// --- Filters ---

function matchesKeywords(text: string, config: any) {
  const kw = config?.keywords;
  if (!kw || !kw.trim()) return true;
  const words = kw.split(',').map((w: string) => w.trim().toLowerCase()).filter(Boolean);
  if (words.length === 0) return true;
  const lower = (text || '').toLowerCase();
  return words.some((w: string) => lower.includes(w));
}

function hasMinusKeywords(text: string, config: any) {
  const mk = config?.minusKeywords;
  if (!mk || !mk.trim()) return false;
  const words = mk.split(',').map((w: string) => w.trim().toLowerCase()).filter(Boolean);
  if (words.length === 0) return false;
  const lower = (text || '').toLowerCase();
  return words.some((w: string) => lower.includes(w));
}

function budgetInRange(budgetMin: number | null | undefined, config: any) {
  if (budgetMin == null) return true;
  const cfgMin = config?.budgetMin;
  const cfgMax = config?.budgetMax;
  if (cfgMin && budgetMin < cfgMin) return false;
  if (cfgMax && budgetMin > cfgMax) return false;
  return true;
}

export async function saveAndNotify(lead: any, source: any, s: any, responseText?: string) {
  const config = s?.config || {};
  const textToCheck = (lead.title || "") + " " + (lead.description || "");
  if (!matchesKeywords(textToCheck, config)) return null;
  if (hasMinusKeywords(textToCheck, config)) return null;

  const extId = lead.externalId || source.platform + "-" + Date.now();

  // Если budgetMin отсутствует — пробуем извлечь из description
  let budgetMin = lead.budgetMin;
  let budgetMax = lead.budgetMax;
  if (!budgetMin && lead.description) {
    const extracted = extractBudget(lead.description);
    budgetMin = extracted.min;
    budgetMax = extracted.max;
  }

  if (!budgetInRange(budgetMin, config)) return null;

  const saved = await db.lead.upsert({
    where: { externalId: extId },
    create: {
      workspaceId: source.workspaceId, sourceId: source.id,
      externalId: extId, title: lead.title, description: lead.description,
      budgetMin, budgetMax,
      url: lead.url, createdAt: new Date(lead.createdAt || Date.now()),
    },
    update: {},
  });
  if (s?.telegramChatId && s?.telegramToken && s?.telegramAlerts !== false) {
    const budgetStr = fmtBudget(budgetMin) || "не указан";
    sendLeadNotification(s.telegramChatId, {
      platform: source.platform, platformColor: source.color || "#22c55e", score: 0,
      title: lead.title || "", budget: budgetStr,
      url: lead.url || "", reasoning: (lead.description || "").slice(0, 250),
      descriptionLength: (lead.description || "").length,
      responseText: responseText || undefined,
      responsePrice: lead.responsePrice || 0,
    }, s.telegramToken).catch(() => {});
  }
  return saved;
}

export function saveStatus(info: any) {
  try { writeFileSync(STATUS_FILE, JSON.stringify({ ...info, updatedAt: new Date().toISOString() })); } catch {}
}

export function mskNow() { return new Date(Date.now() + 3 * 60 * 60 * 1000); }
