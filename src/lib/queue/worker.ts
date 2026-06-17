// Планировщик + обработчик заявок (автономный)
// Запускается как отдельный PM2 процесс
// Каждые 5 минут опрашивает все включённые источники

import { db } from "@/lib/db";
import { getConnector } from "@/lib/connectors/types";
import { analyzeLead, generateResponses } from "@/lib/ai/lead-analyzer";
import { sendLeadNotification } from "@/lib/telegram/notifications";
import type { NormalizedLead } from "@/lib/connectors/types";

// Регистрируем коннекторы
import "@/lib/connectors/profi";

// ─── Состояние ────────────────────────────────────────────────────────────

let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let currentSource: string | null = null;
let lastCheckAt: Date | null = null;
let lastError: string | null = null;

export function getWorkerStatus() {
  return {
    running: isRunning,
    currentSource,
    lastCheckAt: lastCheckAt?.toISOString() || null,
    lastError,
  };
}

// ─── Основной цикл ────────────────────────────────────────────────────────

async function processSource(sourceId: string) {
  const source = await db.source.findUnique({
    where: { id: sourceId },
    include: { workspace: { include: { settings: true } } },
  });

  if (!source || !source.enabled) return;

  const connector = getConnector(source.platform);
  if (!connector) {
    console.warn(`[worker] Коннектор ${source.platform} не найден`);
    return;
  }

  currentSource = `${source.platform}: ${source.name}`;
  const settings = source.workspace.settings;
  const apiKey = settings?.openrouterKey || "";

  try {
    // 1. Получаем заявки
    console.log(`[worker] 📥 ${source.platform}: сбор заявок...`);
    const config = (source.config as Record<string, unknown>) || {};
    config.keywords = settings?.keywords || "";

    const leads = await connector.fetchLeads(config);
    console.log(`[worker]    получено ${leads.length}`);

    // 2. Фильтруем дубликаты
    const existingIds = new Set(
      (await db.lead.findMany({
        where: {
          sourceId: source.id,
          externalId: { in: leads.map(l => l.externalId).filter(Boolean) as string[] },
        },
        select: { externalId: true },
      })).map(l => l.externalId)
    );

    const newLeads = leads.filter(l => !existingIds.has(l.externalId));
    if (newLeads.length === 0) {
      console.log("[worker]    новых нет");
    }

    // 3. Сохраняем и анализируем
    for (const rawLead of newLeads) {
      // Фильтр по минус-словам и бюджету
      const minusWords = (settings?.minusKeywords || "").toLowerCase().split(",").map(w => w.trim()).filter(Boolean);
      const text = `${rawLead.title} ${rawLead.description}`.toLowerCase();
      const hasMinusWord = minusWords.some(w => text.includes(w));
      const budgetOk = !settings?.budgetMin || !rawLead.budgetMin || rawLead.budgetMin >= settings.budgetMin;

      if (hasMinusWord) {
        console.log(`[worker]    ⏭ пропущено (минус-слово): ${rawLead.title?.slice(0, 50)}`);
        continue;
      }
      if (!budgetOk) {
        console.log(`[worker]    ⏭ пропущено (бюджет): ${rawLead.title?.slice(0, 50)} ${rawLead.budgetMin}₽`);
        continue;
      }

      // Сохраняем
      const lead = await db.lead.create({
        data: {
          workspaceId: source.workspaceId,
          sourceId: source.id,
          externalId: rawLead.externalId,
          title: rawLead.title,
          description: rawLead.description,
          budgetMin: rawLead.budgetMin,
          budgetMax: rawLead.budgetMax,
          url: rawLead.url,
          city: rawLead.city,
          author: rawLead.author,
          status: "new",
        },
      });

      console.log(`[worker]    ✅ ${rawLead.title?.slice(0, 60)}`);

      // AI-анализ
      if (apiKey) {
        try {
          const analysis = await analyzeLead(rawLead.title, rawLead.description, { apiKey });

          await db.leadAnalysis.create({
            data: {
              leadId: lead.id, score: analysis.score, budgetPrediction: analysis.budgetPrediction,
              difficulty: analysis.difficulty, recommendation: analysis.recommendation,
              reasoning: analysis.reasoning, modelUsed: "deepseek-chat",
            },
          });

          await db.lead.update({
            where: { id: lead.id },
            data: { score: analysis.score, difficulty: analysis.difficulty },
          });

          console.log(`[worker]    🧠 ${analysis.score}/100 ${analysis.recommendation}`);

          // Отклики для хороших заявок
          if (analysis.score >= 40 && analysis.recommendation !== "Пропустить") {
            const responses = await generateResponses(rawLead.title, rawLead.description, apiKey);
            if (responses) {
              for (const r of [
                { type: "Краткий", content: responses.short },
                { type: "Продающий", content: responses.sales },
                { type: "Экспертный", content: responses.expert },
                { type: "Технический", content: responses.technical },
              ]) {
                await db.response.create({ data: { leadId: lead.id, type: r.type, content: r.content } });
              }
              console.log(`[worker]    📝 4 отклика`);
            }
          }

          // Telegram для приоритетных
          if (analysis.score >= 70 && settings?.telegramChatId) {
            await sendLeadNotification(settings.telegramChatId, {
              platform: source.platform,
              platformColor: (source.color as string) || "#22c55e",
              score: analysis.score,
              title: rawLead.title,
              budget: analysis.budgetPrediction,
              url: rawLead.url,
              reasoning: analysis.reasoning,
            });
            console.log(`[worker]    📱 Telegram`);
          }

          await new Promise(r => setTimeout(r, 1000)); // пауза между AI-запросами
        } catch (aiErr) {
          console.error(`[worker]    ❌ AI:`, aiErr);
        }
      }
    }

    // Обновляем время проверки
    await db.source.update({
      where: { id: source.id },
      data: { lastCheckAt: new Date() },
    });

    lastCheckAt = new Date();
    lastError = null;

    // Журнал
    if (newLeads.length > 0) {
      await db.activityLog.create({
        data: {
          workspaceId: source.workspaceId,
          type: "fetch_leads",
          description: `${source.platform}: собрано ${newLeads.length} новых заявок`,
        },
      });
    }

    currentSource = null;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.error(`[worker] ❌ ${source.platform}:`, lastError);
    currentSource = null;
  }
}

async function pollAllSources() {
  if (!isRunning) return;

  const sources = await db.source.findMany({
    where: { enabled: true },
  });

  console.log(`\n[worker] ⏰ Цикл опроса: ${sources.length} источников`);
  console.log("[worker]", "=".repeat(40));

  for (const source of sources) {
    if (!isRunning) break;
    await processSource(source.id);
  }

  console.log("[worker]", "=".repeat(40));
  console.log("[worker] ✅ Цикл завершён, следующий через 5 мин\n");
}

// ─── Запуск / остановка ───────────────────────────────────────────────────

export function startScheduler(intervalMs = 5 * 60 * 1000) {
  if (isRunning) return;
  isRunning = true;
  lastError = null;

  console.log(`🚀 Worker запущен (интервал: ${intervalMs / 1000} сек)`);

  // Первый запуск через 5 секунд
  setTimeout(() => pollAllSources(), 5000);

  // Далее по расписанию
  intervalId = setInterval(() => pollAllSources(), intervalMs);
}

export function stopScheduler() {
  isRunning = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  console.log("⏸ Worker остановлен");
}

// ─── Автозапуск при импорте ───────────────────────────────────────────────

startScheduler();

process.on("SIGINT", () => { stopScheduler(); process.exit(0); });
process.on("SIGTERM", () => { stopScheduler(); process.exit(0); });
