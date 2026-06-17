// Планировщик + обработчик заявок (автономный)
// Запускается как отдельный PM2 процесс
// Каждые 5 минут опрашивает все включённые источники
// Раз в час — автоочистка старых заявок

import { db } from "@/lib/db";
import { getConnector } from "@/lib/connectors/types";
import { analyzeLead, generateResponses } from "@/lib/ai/lead-analyzer";
import { sendLeadNotification } from "@/lib/telegram/notifications";
import type { NormalizedLead } from "@/lib/connectors/types";

import "@/lib/connectors/profi";

// ─── Состояние ────────────────────────────────────────────────────────────

let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;
let currentSource: string | null = null;
let lastCheckAt: Date | null = null;
let lastError: string | null = null;
let startupTime: Date | null = null;

export function getWorkerStatus() {
  return {
    running: isRunning,
    currentSource,
    lastCheckAt: lastCheckAt?.toISOString() || null,
    lastError,
    uptime: startupTime ? Math.floor((Date.now() - startupTime.getTime()) / 1000) : 0,
  };
}

// ─── Автоочистка ──────────────────────────────────────────────────────────

async function autoCleanup() {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Удаляем заявки с рейтингом <20 старше 3 дней
    const deleted = await db.lead.deleteMany({
      where: { score: { lt: 20 }, createdAt: { lt: threeDaysAgo } },
    });

    // Удаляем непроанализированные старше 7 дней
    const oldDeleted = await db.lead.deleteMany({
      where: { score: null, createdAt: { lt: sevenDaysAgo } },
    });

    const total = deleted.count + oldDeleted.count;
    if (total > 0) {
      console.log(`[worker] 🧹 Автоочистка: удалено ${total} заявок (рейтинг<20/3д: ${deleted.count}, без рейтинга/7д: ${oldDeleted.count})`);
    }
  } catch (err) {
    console.error("[worker] Ошибка автоочистки:", err);
  }
}

// ─── Обработка источника ──────────────────────────────────────────────────

async function processSource(sourceId: string) {
  const source = await db.source.findUnique({
    where: { id: sourceId },
    include: { workspace: { include: { settings: true } } },
  });

  if (!source || !source.enabled) return;

  const connector = getConnector(source.platform);
  if (!connector) return;

  currentSource = `${source.platform}: ${source.name}`;
  const settings = source.workspace.settings;
  const apiKey = settings?.openrouterKey || "";

  try {
    console.log(`[worker] 📥 ${source.platform}: сбор...`);
    const config = (source.config as Record<string, unknown>) || {};
    config.keywords = settings?.keywords || "";

    const leads = await connector.fetchLeads(config);

    const existingIds = new Set(
      (await db.lead.findMany({
        where: { sourceId: source.id, externalId: { in: leads.map(l => l.externalId).filter(Boolean) as string[] } },
        select: { externalId: true },
      })).map(l => l.externalId)
    );

    const newLeads = leads.filter(l => !existingIds.has(l.externalId));
    if (newLeads.length > 0) console.log(`[worker]    новых: ${newLeads.length}`);

    for (const rawLead of newLeads) {
      const minusWords = (settings?.minusKeywords || "").toLowerCase().split(",").map(w => w.trim()).filter(Boolean);
      const text = `${rawLead.title} ${rawLead.description}`.toLowerCase();
      if (minusWords.some(w => text.includes(w))) continue;
      if (settings?.budgetMin && rawLead.budgetMin && rawLead.budgetMin < settings.budgetMin) continue;

      const lead = await db.lead.create({
        data: {
          workspaceId: source.workspaceId, sourceId: source.id,
          externalId: rawLead.externalId, title: rawLead.title,
          description: rawLead.description, budgetMin: rawLead.budgetMin,
          budgetMax: rawLead.budgetMax, url: rawLead.url,
          city: rawLead.city, author: rawLead.author, status: "new",
        },
      });

      console.log(`[worker]    ✅ ${rawLead.title?.slice(0, 60)}`);

      if (apiKey) {
        try {
          const analysis = await analyzeLead(rawLead.title, rawLead.description, { apiKey });
          await db.leadAnalysis.create({
            data: { leadId: lead.id, score: analysis.score, budgetPrediction: analysis.budgetPrediction,
              difficulty: analysis.difficulty, recommendation: analysis.recommendation,
              reasoning: analysis.reasoning, modelUsed: "deepseek-chat",
              botProbability: analysis.botProbability,
            },
          });
          await db.lead.update({ where: { id: lead.id }, data: { score: analysis.score, difficulty: analysis.difficulty } });
          console.log(`[worker]    🧠 ${analysis.score}/100 ${analysis.recommendation}`);

          if (analysis.score >= 40 && analysis.recommendation !== "Пропустить") {
            const responses = await generateResponses(rawLead.title, rawLead.description, apiKey);
            if (responses) {
              for (const r of [
                { type: "Краткий", content: responses.short }, { type: "Продающий", content: responses.sales },
                { type: "Экспертный", content: responses.expert }, { type: "Технический", content: responses.technical },
              ]) {
                await db.response.create({ data: { leadId: lead.id, type: r.type, content: r.content } });
              }
            }
          }

          if (analysis.score >= 70 && settings?.telegramChatId) {
            await sendLeadNotification(settings.telegramChatId, {
              platform: source.platform, platformColor: (source.color as string) || "#22c55e",
              score: analysis.score, title: rawLead.title, budget: analysis.budgetPrediction,
              url: rawLead.url, reasoning: analysis.reasoning,
            });
          }
          await new Promise(r => setTimeout(r, 1000));
        } catch (aiErr) { console.error("[worker] AI:", aiErr); }
      }
    }

    await db.source.update({ where: { id: source.id }, data: { lastCheckAt: new Date() } });
    lastCheckAt = new Date();
    lastError = null;
    currentSource = null;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.error(`[worker] ❌ ${source.platform}:`, lastError);
    currentSource = null;
  }
}

async function pollAllSources() {
  if (!isRunning) return;
  const sources = await db.source.findMany({ where: { enabled: true } });
  console.log(`\n[worker] ⏰ Цикл: ${sources.length} источников`);
  for (const source of sources) {
    if (!isRunning) break;
    await processSource(source.id);
  }
  console.log("[worker] ✅ Цикл завершён\n");
}

// ─── Запуск / остановка ───────────────────────────────────────────────────

export function startScheduler(intervalMs = 5 * 60 * 1000) {
  if (isRunning) return;
  isRunning = true;
  lastError = null;
  startupTime = startupTime || new Date();

  console.log(`🚀 Worker запущен (опрос: ${intervalMs / 1000}с, очистка: раз в час)`);

  setTimeout(() => pollAllSources(), 5000);
  intervalId = setInterval(() => pollAllSources(), intervalMs);

  // Автоочистка при старте и каждый час
  autoCleanup();
  cleanupIntervalId = setInterval(autoCleanup, 60 * 60 * 1000);
}

export function stopScheduler() {
  isRunning = false;
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
  if (cleanupIntervalId) { clearInterval(cleanupIntervalId); cleanupIntervalId = null; }
  console.log("⏸ Worker остановлен");
}

startScheduler();
process.on("SIGINT", () => { stopScheduler(); process.exit(0); });
process.on("SIGTERM", () => { stopScheduler(); process.exit(0); });
