import { db } from "@/lib/db";
import { sendTrackedLeadNotification } from "@/lib/telegram/delivery";
import { extractBudget } from "@/lib/connectors/profi";
import { matchedKeyword, parseFeedCard } from "@/lib/leads/parse-feed-card";
import { budgetPasses, filtersFromConfig, isWithinPartnerHours } from "@/lib/leads/partner-filters";
import { passesGenderFilter } from "@/lib/leads/name-gender";
import { assertCollectionAllowed, recordNewLead } from "@/lib/billing/quota";
import { writeFileSync } from "fs";
import { join } from "path";
import type { Prisma } from "@prisma/client";

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

export async function saveAndNotify(lead: any, source: any, s: any, responseText?: string) {
  const config = { ...(s || {}), ...((s?.config as Record<string, unknown>) || {}) };
  const filters = filtersFromConfig(config as Record<string, unknown>, s);
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

  const parsed = parseFeedCard(String(lead.description || ""), String(lead.title || ""));
  let budgetMin = lead.budgetMin ?? parsed.budgetMin;
  let budgetMax = lead.budgetMax ?? parsed.budgetMax;
  if (!budgetMin && lead.description) {
    const extracted = extractBudget(lead.description);
    budgetMin = extracted.min ?? budgetMin;
    budgetMax = extracted.max ?? budgetMax;
  }
  const city = lead.city || parsed.city || null;

  if (!budgetPasses(budgetMin, filters)) return null;
  if (!passesGenderFilter(lead.author || parsed.author, filters.clientGender)) return null;
  if (!isWithinPartnerHours(filters.workHoursStart, filters.workHoursEnd)) return null;

  const exists = await db.lead.findUnique({ where: { externalId: extId } });
  if (exists) return null;

  const quota = await assertCollectionAllowed(source.workspaceId);
  if (!quota.allowed) return null;

  const author = lead.author || parsed.author || null;
  const reviewCount =
    lead.reviewCount != null ? Number(lead.reviewCount) : parsed.reviewCount ?? null;

  const saved = await db.lead.create({
    data: {
      workspaceId: source.workspaceId, sourceId: source.id,
      externalId: extId, title: lead.title, description: lead.description,
      budgetMin, budgetMax, city,
      author: author || undefined,
      reviewCount: reviewCount ?? undefined,
      url: lead.url, createdAt: new Date(lead.createdAt || Date.now()),
      metadata: {
        feed: {
          responses: parsed.responses ?? null,
          remote: parsed.remote ?? false,
          ageLabel: parsed.ageLabel ?? null,
          responsePrice: lead.responsePrice || parsed.responsePrice || null,
          clientHint: parsed.clientHint ?? null,
          author: author,
          reviewCount: reviewCount,
          newbie: parsed.newbie ?? false,
          taskSnippet: parsed.taskSnippet ?? null,
          riskHint: parsed.riskHint ?? null,
        },
      } as Prisma.InputJsonValue,
    },
  });

  await recordNewLead(source.workspaceId);
  if (s?.telegramChatId && s?.telegramToken && s?.telegramAlerts !== false) {
    const budgetStr = parsed.budgetLabel || fmtBudget(budgetMin) || fmtBudget(budgetMax) || "не указан";
    const blob = `${lead.title || ""} ${lead.description || ""}`;
    sendTrackedLeadNotification({
      workspaceId: source.workspaceId,
      sourceId: source.id,
      leadId: saved.id,
      chatId: s.telegramChatId,
      botToken: s.telegramToken,
      lead: {
        platform: source.platform,
        title: lead.title || "",
        budget: budgetStr,
        url: lead.url || "",
        city: city || undefined,
        remote: parsed.remote,
        responses: parsed.responses,
        responsePrice: lead.responsePrice || parsed.responsePrice,
        ageLabel: parsed.ageLabel,
        matchedKeyword: matchedKeyword(blob, filters.keywords || config.keywords || s?.keywords),
        clientHint: parsed.clientHint,
        taskSnippet: parsed.taskSnippet,
        author: author || undefined,
        reviewCount: reviewCount ?? undefined,
        newbie: parsed.newbie,
        riskHint: parsed.riskHint,
      },
    }).then((ok: boolean) => {
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
