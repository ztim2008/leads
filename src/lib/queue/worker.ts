// Worker v3 — предсказуемый, с диагностикой, Telegram-ошибками
// - Работает 24/7 если расписание не настроено
// - Интервал опроса из настроек (1-15 мин)
// - Ошибки → в ActivityLog + Telegram админу
// - Статус каждого цикла логируется

import { db } from "@/lib/db";
import { getConnector } from "@/lib/connectors/types";
import { scrapeOrderPage, sessionCache } from "@/lib/connectors/profi";
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
let statusReason = "Активна (МСК)";
let startupTime: Date | null = null;
let totalCycles = 0;
let totalErrors = 0;
let totalLeadsCollected = 0;

import { writeFileSync } from "fs";
import { join } from "path";

function saveStatusToFile() {
  try {
    const status = getWorkerStatus();
    writeFileSync(
      join(process.cwd(), ".worker-status.json"),
      JSON.stringify({ ...status, checkIntervalMin: lastKnownInterval / 60000, updatedAt: new Date().toISOString() })
    );
  } catch {}
}

export function getWorkerStatus() {
  return {
    running: isRunning,
    currentSource,
    lastCheckAt: lastCheckAt?.toISOString() || null,
    lastError,
    uptime: startupTime ? Math.floor((Date.now() - startupTime.getTime()) / 1000) : 0,
    totalCycles,
    totalErrors,
    totalLeadsCollected,
    statusReason,
  };
}

// ─── Telegram-уведомление об ошибке ──────────────────────────────────────

async function notifyAdminError(message: string) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || "778784292";
    if (!botToken) return;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: `⚠️ Leads AI — ошибка\n\n${message.replace(/[*_`[\]]/g, "")}`,
        parse_mode: undefined,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {}
}

// ─── Проверка расписания (ТОЛЬКО из БД, без жёстких дефолтов) ────────────


// Московское время (UTC+3)
function moscowNow(): Date {
  return new Date(Date.now() + 3 * 60 * 60 * 1000);
}


// ─── Проверка подписок и уведомления ──────────────────────────────────────

async function checkSubscriptions() {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    // Найти истекающие Pro-подписки (через 1-3 дня)
    const expiringSoon = await db.subscription.findMany({
      where: {
        plan: "pro",
        status: "active",
        expiresAt: { lte: threeDaysFromNow, gt: now },
      },
      include: { workspace: { include: { settings: true } } },
    });

    for (const sub of expiringSoon) {
      const daysLeft = Math.ceil((new Date(sub.expiresAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const ws = sub.workspace;
      const email = (await db.user.findUnique({ where: { id: sub.userId! } }))?.email;
      const tgChatId = ws?.settings?.telegramChatId;
      const tgToken = ws?.settings?.telegramToken;

      console.log(`[billing] ⚠️ Подписка истекает через ${daysLeft} дн: ${email}`);

      // Telegram уведомление
      if (tgChatId && tgToken) {
        try {
          await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: tgChatId,
              text: `⚠️ Ваша Pro-подписка истекает через ${daysLeft} дн.\n\nПродлите подписку чтобы сохранить доступ ко всем функциям:\n\n👉 https://leads.konversus.ru/dashboard/billing`,
              parse_mode: undefined,
            }),
            signal: AbortSignal.timeout(8000),
          });
        } catch {}
      }

      // Email уведомление
      if (email) {
        try {
          const nodemailer = require("nodemailer");
          const transporter = nodemailer.createTransport({
            host: "smtp.yandex.ru", port: 465, secure: true,
            auth: { user: process.env.SMTP_USER || "bilariuss@yandex.ru", pass: process.env.SMTP_PASS || "" },
          });
          await transporter.sendMail({
            from: '"Konversus Leads AI" <bilariuss@yandex.ru>',
            to: email,
            subject: `Подписка истекает через ${daysLeft} дн.`,
            html: `<h2>⚠️ Подписка истекает</h2><p>Ваша Pro-подписка на Konversus Leads AI истекает через <b>${daysLeft} дн.</b></p><p>Продлите подписку чтобы сохранить доступ ко всем функциям:</p><p><a href="https://leads.konversus.ru/dashboard/billing">Продлить →</a></p>`,
          });
        } catch {}
      }
    }

    // Авто-отключение истёкших
    const expired = await db.subscription.findMany({
      where: {
        plan: "pro",
        status: "active",
        expiresAt: { lte: now },
      },
    });

    for (const sub of expired) {
      console.log(`[billing] 🔴 Подписка истекла: ${sub.id}`);

      await db.subscription.update({
        where: { id: sub.id },
        data: { status: "expired", leadsPerDay: 50, sourcesLimit: 1, aiAnalysis: false, aiResponses: false },
      });

      // Telegram — отключение
      const ws = await db.workspace.findUnique({ where: { id: sub.workspaceId! }, include: { settings: true } });
      if (ws?.settings?.telegramChatId && ws?.settings?.telegramToken) {
        try {
          await fetch(`https://api.telegram.org/bot${ws.settings.telegramToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: ws.settings.telegramChatId,
              text: `🔴 Подписка отключена\n\nСрок действия Pro-подписки истёк. Функции ограничены бесплатным планом.\n\nОплатите чтобы продолжить:\n👉 https://leads.konversus.ru/dashboard/billing`,
              parse_mode: undefined,
            }),
            signal: AbortSignal.timeout(8000),
          });
        } catch {}
      }
    }
  } catch (err) {
    console.error("[billing] check error:", err);
  }
}


// ─── Счётчик ошибок авторизации (для авто-сброса) ──────────────────────────

const authErrorCount = new Map<string, number>();

async function handleAuthError(sourceId: string, platform: string, errorMsg: string, workspaceSettings: any) {
  const count = (authErrorCount.get(sourceId) || 0) + 1;
  authErrorCount.set(sourceId, count);

  console.log(`[worker] 🔐 Ошибка авторизации #${count} для ${platform}`);

  if (count >= 3) {
    console.log(`[worker] 🚨 3 ошибки подряд — уведомление!`);

    // Уведомление админу
    await notifyAdminError(
      `🔴 *3 ошибки авторизации подряд*\n\n` +
      `Источник: ${platform}\n` +
      `Ошибка: ${errorMsg.slice(0, 100)}\n\n` +
      `Проверьте логин/пароль в настройках источника.`
    );

    // Уведомление партнёру в его Telegram
    const tgChatId = workspaceSettings?.telegramChatId;
    const tgToken = workspaceSettings?.telegramToken;
    if (tgChatId && tgToken) {
      try {
        await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: tgChatId,
            text: `⚠️ Проблема с подключением к Profi.ru\n\nСистема не может войти 3 раза подряд.\nПроверьте логин и пароль в разделе «Источники».\n\nОшибка: ${errorMsg.slice(0, 80)}`,
            parse_mode: undefined,
          }),
          signal: AbortSignal.timeout(8000),
        });
      } catch {}
    }

    // Сбрасываем счётчик
    authErrorCount.set(sourceId, 0);
  }
}


async function canWorkNow(): Promise<boolean> {
  if (!isRunning) { saveStatusToFile(); return false; }

  try {
    // Проверяем: есть ли хотя бы ОДИН включённый workspace
    const enabledCount = await db.settings.count({ where: { systemEnabled: true } });
    if (enabledCount === 0) {
      statusReason = "Выключена глобально"; saveStatusToFile();
      return false;
    }

    statusReason = "Активна (МСК)";
    return true;
  } catch (err) {
    console.error("[worker] Ошибка проверки:", err);
    statusReason = "Активна (МСК)";
    return true;
  }
}

// ─── Автоочистка (только с явным логом) ──────────────────────────────────

async function autoCleanup() {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const d1 = await db.lead.deleteMany({ where: { score: { lt: 20 }, createdAt: { lt: threeDaysAgo } } });
    const d2 = await db.lead.deleteMany({ where: { score: null, createdAt: { lt: sevenDaysAgo } } });
    const total = d1.count + d2.count;
    if (total > 0) {
      console.log(`[worker] 🧹 Очистка: ${total} заявок (низкий рейтинг/старые)`);
      await logActivity("auto_cleanup", `Удалено ${total} старых заявок`);
    }
  } catch (err) { console.error("[worker] Ошибка очистки:", err); }
}

// ─── Журнал действий ─────────────────────────────────────────────────────

async function logActivity(type: string, description: string, workspaceId?: string) {
  try {
    if (workspaceId) {
      await db.activityLog.create({ data: { workspaceId, type, description } });
    } else {
      // Логируем во все активные workspace
      const wss = await db.workspace.findMany({ where: { settings: { systemEnabled: true } } });
      for (const ws of wss) {
        await db.activityLog.create({ data: { workspaceId: ws.id, type, description } }).catch(() => {});
      }
    }
  } catch {}
}

// ─── Быстрая отправка в Telegram ─────────────────────────────────────────

async function notifyFast(
  lead: { id: string; title: string; url: string; budgetMin: any; description?: string },
  platform: string, color: string,
  telegramChatId: string, telegramToken: string
) {
  try {
    const budget = lead.budgetMin ? `${lead.budgetMin} ₽` : "бюджет не указан";
    await sendLeadNotification(telegramChatId, {
      platform, platformColor: color, score: 0,
      title: lead.title, budget,
      url: lead.url, reasoning: "⚡ Новая заявка! AI-анализ...",
    }, telegramToken);
  } catch {}
}


// ─── Проверка здоровья Telegram-бота ──────────────────────────────────────

async function checkTelegramBot(chatId: string, botToken: string): Promise<{ok: boolean, error?: string}> {
  if (!chatId || !botToken) return { ok: false, error: "Нет Chat ID или Bot Token" };
  try {
    // Проверяем сам бот (getMe)
    const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, { signal: AbortSignal.timeout(8000) });
    const meData = await meRes.json() as any;
    if (!meData.ok) return { ok: false, error: `Бот не отвечает: ${meData.description || "неверный токен"}` };

    // Проверяем может ли бот писать в чат
    const sendRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: "🟢 Leads AI — проверка связи" }),
      signal: AbortSignal.timeout(8000),
    });
    const sendData = await sendRes.json() as any;
    if (!sendData.ok) {
      const desc = sendData.description || "";
      if (desc.includes("chat not found") || desc.includes("bot was blocked")) {
        return { ok: false, error: "Чат не найден или бот заблокирован" };
      }
      return { ok: false, error: desc || "Не удалось отправить сообщение" };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Ошибка соединения" };
  }
}


// ─── Обработка одного источника ──────────────────────────────────────────

async function processSource(sourceId: string) {
  if (!(await canWorkNow())) { console.log(`[worker] ⏸ canWorkNow=false для ${sourceId.slice(0,8)}`); return; }

  const source = await db.source.findUnique({
    where: { id: sourceId },
    include: { workspace: { include: { settings: true } } },
  });
  if (!source || !source.enabled) { console.log(`[worker] ⏸ источник ${sourceId.slice(0,8)} не найден или выключен`); return; }

  const s = source.workspace.settings;
  if (s && !s.systemEnabled) { console.log(`[worker] ⏸ systemEnabled=false для ${source.platform} (${source.config?.login})`); return; }

  // Проверка расписания из БД
  if (s?.workDays && s?.workHoursStart && s?.workHoursEnd) {
    const now = moscowNow();
    const dow = String(now.getDay());
    if (!s.workDays.split(",").includes(dow)) return;
    const mins = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = s.workHoursStart.split(":").map(Number);
    const [eh, em] = s.workHoursEnd.split(":").map(Number);
    if (mins < sh * 60 + sm || mins > eh * 60 + em) return;
  }

  const connector = getConnector(source.platform);
  if (!connector) {
    console.error(`[worker] ❌ Коннектор ${source.platform} не найден`);
    return;
  }

  // currentSource и statusReason для этого источника
  const prevSource = currentSource;
  currentSource = `${source.platform}`;
  statusReason = `Сбор: ${source.platform}`;
  const apiKey = s?.openrouterKey || "";
  const config = (source.config as Record<string, unknown>) || {};
  config.keywords = s?.keywords || "";
  config.sourceId = source.id;  // изоляция браузеров на каждый источник

  try {
    console.log(`[worker] 📥 ${source.platform}: сбор...`);
    const leads = await connector.fetchLeads(config);

    if (leads.length === 0) {
      // Проверка Telegram-бота этого workspace
      const tgChatId = s?.telegramChatId;
      const tgToken = s?.telegramToken;
      if (tgChatId && tgToken) {
        const tgHealth = await checkTelegramBot(tgChatId, tgToken);
        if (!tgHealth.ok) {
          console.log(`[worker] 📱 Telegram бот ${source.platform}: ${tgHealth.error}`);
        }
      }
      
      // Проверка: 0 заявок может означать проблему с коннектором
      await logActivity("fetch_empty", `${source.platform}: 0 заявок — возможна проблема с авторизацией`, source.workspaceId);
    }

    // Нормализуем externalId (без analytics_data) для дедупликации
    const normalizeId = (id: string) => id.replace(/&analytics_data=.*$/, '');
    
    // Загружаем ВСЕ externalId для этого source (может быть много)
    const allExisting = (await db.lead.findMany({
      where: { sourceId: source.id },
      select: { externalId: true },
    })).map(l => normalizeId(l.externalId || ''));
    const existingIds = new Set(allExisting);

    const newLeads = leads.filter(l => !existingIds.has(normalizeId(l.externalId)));
    if (newLeads.length > 0) {
      console.log(`[worker]    новых: ${newLeads.length}`);
      totalLeadsCollected += newLeads.length;
      await logActivity("fetch_leads", `${source.platform}: ${newLeads.length} новых заявок`, source.workspaceId);
    }

    for (const rawLead of newLeads) {
      const minusWords = (s?.minusKeywords || "").toLowerCase().split(",").map(w => w.trim()).filter(Boolean);
      const text = `${rawLead.title} ${rawLead.description}`.toLowerCase();
      if (minusWords.some(w => text.includes(w))) continue;

      // Фильтр «только с отзывами» — применяется ПОСЛЕ глубокого сканирования
      // для бесплатных пользователей пропускаем (не можем проверить)
      // Бюджетный фильтр
      if (rawLead.budgetMin) {
        if (s?.budgetMin && rawLead.budgetMin < s.budgetMin) continue;
        if (s?.budgetMax && rawLead.budgetMin > s.budgetMax) continue;
      } else {
        // Нет бюджета — показываем только если showNoBudget
        if (s && !s.showNoBudget) continue;
      }

      const lead = await db.lead.create({
        data: {
          workspaceId: source.workspaceId, sourceId: source.id,
          externalId: rawLead.externalId, title: rawLead.title,
          description: rawLead.description, budgetMin: rawLead.budgetMin,
          budgetMax: rawLead.budgetMax, url: rawLead.url,
          city: rawLead.city, author: rawLead.author, status: "new",
        },
      });

      if (s?.telegramChatId && s?.telegramToken && s?.telegramAlerts !== false) {
        const descPreview = (rawLead.description || "").slice(0, 150).replace(/\n/g, " ");
            notifyFast({ id: lead.id, title: rawLead.title, url: rawLead.url, budgetMin: rawLead.budgetMin, description: descPreview || rawLead.title }, source.platform, (source.color as string) || "#22c55e", s.telegramChatId, s.telegramToken);
      }

      // Глубокий просмотр для Pro
      const sub = await db.subscription.findFirst({ where: { workspaceId: source.workspaceId } });
      const isPro = sub?.plan === "pro" && sub?.status === "active";
      if (isPro && rawLead.url && rawLead.url.includes("?o=")) {
        scrapeOrderPage(source.id, rawLead.url).then(async (details) => {
          if (!details) return;
          try {
            await db.lead.update({
              where: { id: lead.id },
              data: {
                author: details.author || undefined,
                reviewCount: details.reviewCount || null,
                description: details.fullDescription || rawLead.description,
                city: details.city || rawLead.city,
                clientRating: details.clientRating || null,
                metadata: {
                  rating: details.rating,
                  lastOnline: details.lastOnline,
                  budgetRaw: details.budgetRaw,
                },
              },
            });
            
            // Фильтр: только с отзывами
            if (s?.showOnlyWithReviews && (!details.reviewCount || details.reviewCount === 0)) {
              await db.lead.delete({ where: { id: lead.id } });
              await db.leadAnalysis.deleteMany({ where: { leadId: lead.id } });
              console.log(`[worker] 🗑 Удалена заявка без отзывов: ${lead.id.slice(0,8)}`);
              return;
            }

            // Фильтр: минимальный рейтинг клиента
            const minRating = s?.minClientRating;
            if (minRating && (!details.clientRating || details.clientRating < minRating)) {
              await db.lead.delete({ where: { id: lead.id } });
              await db.leadAnalysis.deleteMany({ where: { leadId: lead.id } });
              console.log(`[worker] 🗑 Удалена заявка с низким рейтингом (${details.clientRating || 0} < ${minRating}): ${lead.id.slice(0,8)}`);
              return;
            }

            // Повторное уведомление с обогащёнными данными
            if (s?.telegramChatId && s?.telegramToken && s?.telegramAlerts !== false) {
              const reviewInfo = details.reviewCount ? `⭐${details.reviewCount} отз.` : "";
              const authorInfo = details.author ? `👤 ${details.author}` : "";
              const stars = details.clientRating ? "★".repeat(details.clientRating) + "☆".repeat(3 - details.clientRating) : "";
              await sendLeadNotification(s.telegramChatId, {
                platform: source.platform,
                platformColor: (source.color as string) || "#22c55e",
                score: 0,
                title: rawLead.title,
                budget: rawLead.budgetMin ? `${rawLead.budgetMin} ₽` : "бюджет не указан",
                url: rawLead.url,
                reasoning: [stars, authorInfo, reviewInfo, (details.fullDescription || rawLead.description || "").slice(0, 200).replace(/\n/g, " ")].filter(Boolean).join("\n"),
              }, s.telegramToken);
            }
          } catch (e) {
            console.error("[worker] Ошибка обновления после deep scan:", e);
          }
        }).catch(() => {});
      }

      if (apiKey) {
        analyzeLead(rawLead.title, rawLead.description, { apiKey })
          .then(async (analysis) => {
            await db.leadAnalysis.create({ data: { leadId: lead.id, score: analysis.score, budgetPrediction: analysis.budgetPrediction, difficulty: analysis.difficulty, recommendation: analysis.recommendation, reasoning: analysis.reasoning, modelUsed: "deepseek-chat", botProbability: analysis.botProbability } });
            await db.lead.update({ where: { id: lead.id }, data: { score: analysis.score, difficulty: analysis.difficulty } });
            if (analysis.score >= 40 && analysis.recommendation !== "Пропустить") {
              const responses = await generateResponses(rawLead.title, rawLead.description, apiKey);
              if (responses) {
                for (const r of [{ type: "Краткий", content: responses.short }, { type: "Продающий", content: responses.sales }, { type: "Экспертный", content: responses.expert }, { type: "Технический", content: responses.technical }]) {
                  await db.response.create({ data: { leadId: lead.id, type: r.type, content: r.content } });
                }
              }
            }
            if (analysis.score >= 70 && s?.telegramChatId && s?.telegramToken) {
              await sendLeadNotification(s.telegramChatId, { platform: source.platform, platformColor: (source.color as string) || "#22c55e", score: analysis.score, title: rawLead.title, budget: analysis.budgetPrediction, url: rawLead.url, reasoning: analysis.reasoning }, s.telegramToken);
            }
          })
          .catch((aiErr) => {
            console.error(`[worker] AI-ошибка для "${rawLead.title?.slice(0, 40)}":`, aiErr);
            logActivity("ai_error", `Ошибка AI: ${aiErr}`);
          });
      }
    }

    await db.source.update({ where: { id: source.id }, data: { lastCheckAt: new Date(), status: "active", lastError: null } });
    lastCheckAt = new Date();
    lastError = null;
    authErrorCount.set(source.id, 0);  // сброс счётчика ошибок
    statusReason = "Активна (МСК)";
    currentSource = null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    lastError = msg;
    statusReason = `Ошибка: ${msg.slice(0, 40)}`;
    totalErrors++;
    console.error(`[worker] ❌ ${source.platform}: ${msg}`);
    await db.source.update({ where: { id: source.id }, data: { status: "error", lastError: msg.slice(0, 500) } });
    await logActivity("fetch_error", `${source.platform}: ${msg.slice(0, 200)}`, source.workspaceId);

    // При ошибке сессии — удаляем кеш чтобы заново залогиниться
    if (msg.includes("сессия истекла") || msg.includes("неверный логин") || msg.includes("неверный пароль")) {
      try { sessionCache.delete(source.id); } catch {}
    }

    // Сброс счётчика при успехе (выше)
    // При ошибке авторизации — инкремент
    if (msg.includes("логин") || msg.includes("парол") || msg.includes("вход") || msg.includes("login") || msg.includes("auth") || msg.includes("неверный")) {
      await handleAuthError(source.id, source.platform, msg, s);
    } else {
      // Не авторизация — сбрасываем счётчик
      authErrorCount.set(source.id, 0);
    }

    // Telegram-уведомление о критической ошибке админу (каждую)
    if (msg.includes("логин") || msg.includes("парол") || msg.includes("вход") || msg.includes("login") || msg.includes("auth")) {
      await notifyAdminError(`🔴 *Ошибка авторизации* ${source.platform}\n\n${msg}\n\nПроверьте логин/пароль в настройках источника.`);
    } else if (totalErrors % 5 === 0) { // каждую 5-ю ошибку
      await notifyAdminError(`⚠️ *Ошибка сбора* ${source.platform}\n\n${msg}\n\nОшибок всего: ${totalErrors}`);
    }

    currentSource = null;
  }
}

// ─── Основной цикл ────────────────────────────────────────────────────────

let lastKnownInterval = 0;

async function pollAllSources() {
  // Динамическая проверка интервала — МИНИМАЛЬНЫЙ среди всех активных
  try {
    const allSettings = await db.settings.findMany({
      where: { systemEnabled: true },
      select: { checkInterval: true },
    });
    const intervals = allSettings.map(s => s.checkInterval).filter(Boolean);
    const minInterval = intervals.length > 0 ? Math.min(...intervals) : 3;
    const newInterval = Math.max(minInterval * 60 * 1000, 60 * 1000);
    if (newInterval !== lastKnownInterval && lastKnownInterval > 0) {
      console.log(`[worker] 🔄 Интервал изменён: ${lastKnownInterval/60000}→${newInterval/60000} мин`);
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => pollAllSources(), newInterval);
    }
    lastKnownInterval = newInterval;
  } catch {}
  if (!(await canWorkNow())) return;

  const sources = await db.source.findMany({ where: { enabled: true, status: { not: "pending" } } });
  if (sources.length === 0) return;

  totalCycles++;
  saveStatusToFile();
  console.log(`\n[worker] ⏰ Цикл #${totalCycles}: ${sources.length} источников`);
  await logActivity("cycle_start", `Цикл #${totalCycles}: ${sources.length} источников`);

  // Параллельная обработка источников — у каждого свой браузер
  // Заявки доставляются в Telegram сразу, не ждут другие источники
  console.log(`[worker] 📋 Источники: ${sources.map(s => `${s.platform}(${(s.config as any)?.login || '?'})`).join(', ')}`);
  await Promise.all(sources.map(source => 
    processSource(source.id).then(() => {
      console.log(`[worker] ✅ Источник ${source.platform}(${((source.config || {}) as Record<string, any>)?.login || '?'}) завершён`);
    }).catch(err => {
      console.error(`[worker] ❌ Ошибка источника ${source.platform}(${((source.config || {}) as Record<string, any>)?.login || '?'}):`, err.message || err);
    })
  ));

  saveStatusToFile();
  console.log(`[worker] ✅ Цикл #${totalCycles} завершён (собрано: ${totalLeadsCollected})\n`);
}

// ─── Запуск ───────────────────────────────────────────────────────────────

// Проверка подписок каждый час
  setInterval(checkSubscriptions, 60 * 60 * 1000);

  export function startScheduler(intervalMs?: number) {
  if (isRunning) return;
  isRunning = true;
  startupTime = startupTime || new Date();

  // Минимальный интервал 60 сек чтобы не получить бан от Profi
  const ms = Math.max(intervalMs || 3 * 60 * 1000, 60 * 1000);
  console.log(`🚀 Worker запущен (опрос: каждые ${ms / 1000}с)`);
  console.log(`🕐 Расписание: из БД, без настроек — 24/7`);
  console.log(`📱 Telegram: мгновенные + ошибки админу`);
  console.log(`📋 Журнал: все события в activity_log`);

  logActivity("worker_start", `Worker запущен (интервал ${ms / 1000}с)`);

  setTimeout(() => pollAllSources(), 3000);
  intervalId = setInterval(() => pollAllSources(), ms);

  autoCleanup();
  checkSubscriptions();
  cleanupIntervalId = setInterval(autoCleanup, 60 * 60 * 1000);
}

export function stopScheduler() {
  isRunning = false;
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
  if (cleanupIntervalId) { clearInterval(cleanupIntervalId); cleanupIntervalId = null; }
  logActivity("worker_stop", "Worker остановлен");
  console.log("⏸ Worker остановлен");
}

// Динамический перезапуск с новым интервалом
export async function restartScheduler() {
  stopScheduler();
  const allSettings = await db.settings.findMany({
    where: { systemEnabled: true },
    select: { checkInterval: true },
  });
  const intervals = allSettings.map(s => s.checkInterval).filter(Boolean);
  const intervalMin = intervals.length > 0 ? Math.min(...intervals) : 3;
  startScheduler(intervalMin * 60 * 1000);
}

// СТАРТ ТОЛЬКО ЧЕРЕЗ worker-run.ts (PM2 процесс)
// Не запускаем здесь — иначе web-процесс создаст второй воркер

process.on("SIGINT", () => { stopScheduler(); process.exit(0); });
process.on("SIGTERM", () => { stopScheduler(); process.exit(0); });
