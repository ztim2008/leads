// Обработчик очереди заявок (BullMQ Worker)
// Запускается как отдельный процесс через PM2

import { Worker, Queue } from "bullmq";
import { db } from "@/lib/db";
import { getConnector } from "@/lib/connectors/types";
import { analyzeLead } from "@/lib/ai/lead-analyzer";
import { sendLeadNotification } from "@/lib/telegram/notifications";
import type { NormalizedLead } from "@/lib/connectors/types";

// Импортируем все коннекторы для регистрации
import "@/lib/connectors/profi";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const leadQueue = new Queue("leads-processing", {
  connection: { url: REDIS_URL },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export const worker = new Worker(
  "leads-processing",
  async (job) => {
    const { sourceId, workspaceId } = job.data as {
      sourceId: string;
      workspaceId: string;
    };

    // Получаем источник и настройки
    const source = await db.source.findUnique({
      where: { id: sourceId },
      include: {
        workspace: {
          include: { settings: true },
        },
      },
    });

    if (!source || !source.enabled) {
      console.log(`[worker] Источник ${sourceId} выключен или не найден`);
      return;
    }

    const connector = getConnector(source.platform);
    if (!connector) {
      console.error(`[worker] Коннектор ${source.platform} не найден`);
      return;
    }

    const settings = source.workspace.settings;
    const apiKey = settings?.openrouterKey || process.env.OPENROUTER_API_KEY || "";

    // 1. Получаем заявки с площадки
    console.log(`[worker] Загрузка заявок из ${source.platform}...`);
    const leads = await connector.fetchLeads(source.config as Record<string, unknown>);

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
    console.log(`[worker] Найдено ${leads.length}, новых: ${newLeads.length}`);

    // 3. Сохраняем и анализируем
    for (const rawLead of newLeads) {
      try {
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

        // AI-анализ
        if (apiKey) {
          try {
            const analysis = await analyzeLead(
              rawLead.title,
              rawLead.description,
              {
                model: "deepseek/deepseek-chat",
                apiKey,
              }
            );

            await db.leadAnalysis.create({
              data: {
                leadId: lead.id,
                score: analysis.score,
                budgetPrediction: analysis.budgetPrediction,
                difficulty: analysis.difficulty,
                recommendation: analysis.recommendation,
                reasoning: analysis.reasoning,
                modelUsed: "claude-sonnet-4.5",
              },
            });

            await db.lead.update({
              where: { id: lead.id },
              data: { score: analysis.score, difficulty: analysis.difficulty },
            });

            // Telegram-уведомление
            if (analysis.score >= 40 && settings?.telegramChatId) {
              await sendLeadNotification(settings.telegramChatId, {
                platform: source.platform,
                platformColor: source.color || "#6366f1",
                score: analysis.score,
                title: rawLead.title,
                budget: analysis.budgetPrediction || `${rawLead.budgetMin || "?"}–${rawLead.budgetMax || "?"} ₽`,
                url: rawLead.url,
                reasoning: analysis.reasoning,
              });
            }

            // Журнал
            await db.activityLog.create({
              data: {
                workspaceId: source.workspaceId,
                type: "ai_analysis",
                description: `Проанализирована заявка "${rawLead.title.slice(0, 80)}" — оценка ${analysis.score}`,
              },
            });
          } catch (aiError) {
            console.error("[worker] Ошибка AI-анализа:", aiError);
          }
        }

        // Журнал
        await db.activityLog.create({
          data: {
            workspaceId: source.workspaceId,
            type: "fetch_leads",
            description: `Новая заявка с ${source.platform}: "${rawLead.title.slice(0, 80)}"`,
          },
        });
      } catch (dbError) {
        console.error("[worker] Ошибка сохранения заявки:", dbError);
      }
    }

    // Обновляем время последней проверки
    await db.source.update({
      where: { id: source.id },
      data: { lastCheckAt: new Date() },
    });

    console.log(`[worker] Обработка ${source.platform} завершена`);
  },
  {
    connection: { url: REDIS_URL },
    concurrency: 3,
  }
);

// Обработчики событий
worker.on("completed", (job) => {
  console.log(`[worker] Задание ${job.id} выполнено`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] Ошибка задания ${job?.id}:`, err);
});
