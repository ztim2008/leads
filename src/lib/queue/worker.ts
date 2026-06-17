// Планировщик + обработчик — скорость + расписание
// Приоритет: мгновенные уведомления в Telegram
// Проверка расписания ПЕРЕД каждым действием

import { db } from "@/lib/db";
import { getConnector } from "@/lib/connectors/types";
import { analyzeLead, generateResponses } from "@/lib/ai/lead-analyzer";
import { sendLeadNotification } from "@/lib/telegram/notifications";

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

// ─── Проверка расписания (жёсткая) ───────────────────────────────────────

function canWorkNow(): boolean {
  try {
    // Проверяем глобально и через БД
    if (!isRunning) return false;
    
    // Синхронная проверка времени (без БД) — быстрый фильтр
    const now = new Date();
    const dayOfWeek = String(now.getDay());
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    // Дефолтное расписание если настройки недоступны
    const defaultStart = 9 * 60;  // 09:00
    const defaultEnd = 21 * 60;   // 21:00
    const defaultDays = ["1", "2", "3", "4", "5"]; // Пн-Пт
    
    if (!defaultDays.includes(dayOfWeek)) return false;
    if (currentTime < defaultStart || currentTime > defaultEnd) return false;
    
    return true;
  } catch {
    return true; // по умолчанию разрешаем
  }
}

// ─── Автоочистка ──────────────────────────────────────────────────────────

async function autoCleanup() {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const deleted = await db.lead.deleteMany({ where: { score: { lt: 20 }, createdAt: { lt: threeDaysAgo } } });
    const oldDeleted = await db.lead.deleteMany({ where: { score: null, createdAt: { lt: sevenDaysAgo } } });
    const total = deleted.count + oldDeleted.count;
    if (total > 0) console.log(`[worker] 🧹 Автоочистка: ${total} заявок`);
  } catch (err) { console.error("[worker] Ошибка очистки:", err); }
}

// ─── Быстрая отправка в Telegram (до AI) ─────────────────────────────────

async function notifyFast(lead: { id: string; title: string; url: string; budgetMin: any }, platform: string, platformColor: string) {
  try {
    const settings = await db.settings.findFirst();
    if (!settings?.telegramChatId || !settings?.telegramToken) return;
    
    const budget = lead.budgetMin ? `${lead.budgetMin} ₽` : "бюджет не указан";
    
    // Шлём БЫСТРОЕ уведомление — новая заявка, без AI
    await sendLeadNotification(settings.telegramChatId, {
      platform,
      platformColor,
      score: 0, // без оценки пока
      title: lead.title,
      budget,
      url: lead.url,
      reasoning: "⚡ Новая заявка! AI-анализ выполняется...",
    }, settings.telegramToken);
  } catch (e) { /* игнорируем ошибки Telegram */ }
}

// ─── Основной цикл ────────────────────────────────────────────────────────

async function processSource(sourceId: string) {
  if (!canWorkNow()) return;

  const source = await db.source.findUnique({
    where: { id: sourceId },
    include: { workspace: { include: { settings: true } } },
  });
  if (!source || !source.enabled) return;

  // Жёсткая проверка из БД
  const s = source.workspace.settings;
  if (s && !s.systemEnabled) {
    console.log("[worker] ⏸ systemEnabled=false — пропускаем");
    return;
  }
  if (s?.workDays && s?.workHoursStart && s?.workHoursEnd) {
    const now = new Date();
    const dow = String(now.getDay());
    if (!s.workDays.split(",").includes(dow)) {
      console.log(`[worker] ⏸ Сегодня выходной (${dow})`);
      return;
    }
    const mins = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = s.workHoursStart.split(":").map(Number);
    const [eh, em] = s.workHoursEnd.split(":").map(Number);
    if (mins < sh * 60 + sm || mins > eh * 60 + em) {
      console.log(`[worker] ⏸ Нерабочее время (${s.workHoursStart}-${s.workHoursEnd})`);
      return;
    }
  }

  const connector = getConnector(source.platform);
  if (!connector) return;

  currentSource = `${source.platform}`;
  const apiKey = s?.openrouterKey || "";
  const config = (source.config as Record<string, unknown>) || {};
  config.keywords = s?.keywords || "";

  try {
    console.log(`[worker] 📥 ${source.platform}: сбор...`);
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
      // Фильтр минус-слов
      const minusWords = (s?.minusKeywords || "").toLowerCase().split(",").map(w => w.trim()).filter(Boolean);
      const text = `${rawLead.title} ${rawLead.description}`.toLowerCase();
      if (minusWords.some(w => text.includes(w))) continue;
      if (s?.budgetMin && rawLead.budgetMin && rawLead.budgetMin < s.budgetMin) continue;

      // Сохраняем
      const lead = await db.lead.create({
        data: {
          workspaceId: source.workspaceId, sourceId: source.id,
          externalId: rawLead.externalId, title: rawLead.title,
          description: rawLead.description, budgetMin: rawLead.budgetMin,
          budgetMax: rawLead.budgetMax, url: rawLead.url,
          city: rawLead.city, author: rawLead.author, status: "new",
        },
      });

      // ⚡ МГНОВЕННОЕ уведомление в Telegram (до AI!)
      if (s?.telegramChatId && s?.telegramToken) {
        notifyFast(
          { id: lead.id, title: rawLead.title, url: rawLead.url, budgetMin: rawLead.budgetMin },
          source.platform,
          (source.color as string) || "#22c55e"
        );
      }

      console.log(`[worker]    ✅ ${rawLead.title?.slice(0, 50)}`);

      // AI-анализ (асинхронно, не блокирует следующие заявки)
      if (apiKey) {
        analyzeLead(rawLead.title, rawLead.description, { apiKey })
          .then(async (analysis) => {
            await db.leadAnalysis.create({
              data: {
                leadId: lead.id, score: analysis.score, budgetPrediction: analysis.budgetPrediction,
                difficulty: analysis.difficulty, recommendation: analysis.recommendation,
                reasoning: analysis.reasoning, modelUsed: "deepseek-chat",
                botProbability: analysis.botProbability,
              },
            });
            await db.lead.update({ where: { id: lead.id }, data: { score: analysis.score, difficulty: analysis.difficulty } });

            // Отклики для хороших
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

            // Повторное уведомление с AI-оценкой для高分 заявок
            if (analysis.score >= 70 && s?.telegramChatId && s?.telegramToken) {
              await sendLeadNotification(s.telegramChatId, {
                platform: source.platform,
                platformColor: (source.color as string) || "#22c55e",
                score: analysis.score,
                title: rawLead.title,
                budget: analysis.budgetPrediction,
                url: rawLead.url,
                reasoning: analysis.reasoning,
              }, s.telegramToken);
            }
          })
          .catch((aiErr) => console.error("[worker] AI:", aiErr));
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
  if (!canWorkNow()) {
    console.log("[worker] ⏸ Нерабочее время — пропускаем цикл");
    return;
  }

  const sources = await db.source.findMany({ where: { enabled: true } });
  if (sources.length === 0) return;

  console.log(`\n[worker] ⏰ Цикл: ${sources.length} источников`);
  for (const source of sources) {
    if (!isRunning || !canWorkNow()) break;
    await processSource(source.id);
  }
  console.log("[worker] ✅ Цикл завершён\n");
}

// ─── Запуск ───────────────────────────────────────────────────────────────

export function startScheduler(intervalMs = 3 * 60 * 1000) {
  if (isRunning) return;
  isRunning = true;
  lastError = null;
  startupTime = startupTime || new Date();

  console.log(`🚀 Worker запущен (опрос: каждые ${intervalMs / 1000}с)`);
  console.log(`🕐 Расписание: проверка перед каждым циклом`);
  console.log(`📱 Telegram: мгновенные уведомления о новых заявках`);

  setTimeout(() => pollAllSources(), 3000);
  intervalId = setInterval(() => pollAllSources(), intervalMs);

  autoCleanup();
  cleanupIntervalId = setInterval(autoCleanup, 60 * 60 * 1000);
}

export function stopScheduler() {
  isRunning = false;
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
  if (cleanupIntervalId) { clearInterval(cleanupIntervalId); cleanupIntervalId = null; }
  console.log("⏸ Worker остановлен");
}

startScheduler(3 * 60 * 1000); // каждые 3 минуты (быстрее!)

process.on("SIGINT", () => { stopScheduler(); process.exit(0); });
process.on("SIGTERM", () => { stopScheduler(); process.exit(0); });
