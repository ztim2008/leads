import { db } from "@/lib/db";
import { sendLeadNotification } from "@/lib/telegram/notifications";
import { extractBudget } from "@/lib/connectors/profi";
import { assertCollectionAllowed, recordNewLead } from "@/lib/billing/quota";
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
  // config: если s.config есть (source config) — берём его, иначе s — это settings напрямую
  const config = s?.config || s || {};
  const title = (lead.title || "").toLowerCase();
  const desc = (lead.description || "").toLowerCase();

  // Title: если есть titleKeywords — проверяем заголовок отдельно
  if (config.titleKeywords) {
    if (!matchesKeywords(title, { keywords: config.titleKeywords })) return null;
  }
  if (config.titleMinusKeywords) {
    if (hasMinusKeywords(title, { minusKeywords: config.titleMinusKeywords })) return null;
  }

  // Description: keywords проверяем по описанию
  // Если titleKeywords не задан — проверяем keywords по title+description (обратная совместимость)
  if (config.titleKeywords) {
    // Раздельный режим: keywords только для описания
    if (!matchesKeywords(desc, config)) return null;
    if (hasMinusKeywords(desc, config)) return null;
  } else {
    // Старый режим: keywords по title+description
    const combined = title + " " + desc;
    if (!matchesKeywords(combined, config)) return null;
    if (hasMinusKeywords(combined, config)) return null;
  }

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

  const exists = await db.lead.findUnique({ where: { externalId: extId } });
  if (exists) return null;

  const quota = await assertCollectionAllowed(source.workspaceId);
  if (!quota.allowed) return null;

  const saved = await db.lead.create({
    data: {
      workspaceId: source.workspaceId, sourceId: source.id,
      externalId: extId, title: lead.title, description: lead.description,
      budgetMin, budgetMax,
      url: lead.url, createdAt: new Date(lead.createdAt || Date.now()),
    },
  });

  await recordNewLead(source.workspaceId);
  if (s?.telegramChatId && s?.telegramToken && s?.telegramAlerts !== false) {
    const budgetStr = fmtBudget(budgetMin) || "не указан";
    sendLeadNotification(s.telegramChatId, {
      platform: source.platform, platformColor: source.color || "#22c55e", score: 0,
      title: lead.title || "", budget: budgetStr,
      url: lead.url || "", reasoning: (lead.description || "").slice(0, 250),
      descriptionLength: (lead.description || "").length,
      responseText: responseText || undefined,
      responsePrice: lead.responsePrice || 0,
    }, s.telegramToken).then((ok: boolean) => {
      if (!ok) console.error("[shared] Telegram send FAILED for", lead.title?.slice(0, 40));
    }).catch((e: any) => {
      console.error("[shared] Telegram send ERROR:", e?.message || e);
    });
  }
  return saved;
}

export function saveStatus(info: any) {
  try { writeFileSync(STATUS_FILE, JSON.stringify({ ...info, updatedAt: new Date().toISOString() })); } catch {}
}

export function mskNow() { return new Date(Date.now() + 3 * 60 * 60 * 1000); }
