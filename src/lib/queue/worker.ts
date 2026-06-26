// @ts-nocheck
// Worker v4 — гуманный режим, анти-детект
// - Активный опрос: 8:00-22:00 МСК, случайный интервал (1-25 мин)
// - Ночной режим: раз в 2-3 часа
// - Случайные пропуски 20% (имитация занятости)
// - Пул интервалов [1, 3, 5, 7, 11, 13, 15, 17, 20, 25] мин + секундный джиттер
// - Ошибки → в ActivityLog + Telegram админу
// - Статус каждого цикла логируется

import { db } from "@/lib/db";
import { getConnector } from "@/lib/connectors/types";
import { scrapeOrderPage, sessionCache, startWatching, stopWatching } from "@/lib/connectors/profi";
import { analyzeLead, generateResponses } from "@/lib/ai/lead-analyzer";
import { pulseCheck, notifyStart, notifyStop } from "@/lib/notifications/pulse";
import { sendLeadNotification } from "@/lib/telegram/notifications";
import type { WatchCallbacks } from "@/lib/connectors/profi";

import "@/lib/connectors/profi";

// ─── Состояние ────────────────────────────────────────────────────────────

let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;
let currentSource: string | null = null;
let lastCheckAt: Date | null = null;
let lastError: string | null = null;
let statusReason = "✅ Активен (МСК)";
let startupTime: Date | null = null;
let totalCycles = 0;
let totalErrors = 0;
let totalLeadsCollected = 0;

import { writeFileSync } from "fs";
import { join } from "path";

function saveStatusToFile() {
  try {
    const status = getWorkerStatus();
    // Если ждун активен — показываем его статус, не циклического опроса
    const hasWatchSessions = typeof globalThis !== "undefined" && (globalThis as any).__watchActive;
    writeFileSync(
      join(process.cwd(), ".worker-status.json"),
      JSON.stringify({
        ...status,
        mode: hasWatchSessions ? "watch" : "random",
        intervalPool: RANDOM_INTERVAL_POOL,
        updatedAt: new Date().toISOString(),
        statusReason: hasWatchSessions && (status.statusReason?.includes("Активен") || status.statusReason?.includes("Ожидание"))
          ? "👀 Ждун: слежу за новыми заказами"
          : status.statusReason,
        watchLeads: totalLeadsCollected,
      })
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

// ─── Человеческое расписание (МСК) ──────────────────────────────────────

function isWorkingHours(): boolean {
  const hour = moscowNow().getUTCHours();
  return hour >= 8 && hour < 22; // активный опрос 8:00-22:00 МСК
}

function isNightTime(): boolean {
  const hour = moscowNow().getUTCHours();
  return hour >= 1 && hour < 7; // глубокий сон 1:00-7:00 МСК
}

// Случайный пропуск цикла — имитация «забыл проверить», «занят», «отошёл»
function shouldSkipThisCycle(): boolean {
  return Math.random() < 0.20; // 20% циклов пропускаем
}

// Ночной интервал: раз в 2-3 часа
function getNightIntervalMs(): number {
  return (120 + Math.floor(Math.random() * 60)) * 60 * 1000; // 120-180 мин
}

// Пул случайных интервалов (минуты) — имитация непредсказуемого человека
const RANDOM_INTERVAL_POOL = [1, 3, 5, 7, 11, 13, 15, 17, 20, 25];
let lastIntervalIndex = -1;

function getRandomIntervalMs(): number {
  // Не повторяем последний интервал (человек не ходит с одинаковым ритмом)
  let idx: number;
  do {
    idx = Math.floor(Math.random() * RANDOM_INTERVAL_POOL.length);
  } while (idx === lastIntervalIndex && RANDOM_INTERVAL_POOL.length > 1);
  lastIntervalIndex = idx;
  const minutes = RANDOM_INTERVAL_POOL[idx];
  // Добавляем секундный джиттер ±30% внутри выбранной минуты
  const jitter = 0.7 + Math.random() * 0.6;
  return Math.round(minutes * 60 * 1000 * jitter);
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

async function handleAuthError(sourceId: string, platform: string, errorMsg: string, workspaceSettings: any, workspaceName?: string) {
  const count = (authErrorCount.get(sourceId) || 0) + 1;
  authErrorCount.set(sourceId, count);

  const userTag = workspaceName ? ` (${workspaceName})` : "";
  console.log(`[worker] 🔐 Ошибка авторизации #${count} для ${platform}${userTag}`);

  // Первая ошибка — немедленное уведомление админу
  if (count === 1) {
    await notifyAdminError(
      `🔴 Ошибка входа ${platform}${userTag}\n\n${errorMsg.slice(0, 150)}\n\nСистема продолжит попытки.`
    );
  }

  // Третья ошибка — повторное + партнёру
  if (count >= 3) {
    console.log(`[worker] 🚨 3 ошибки подряд — повторное уведомление!`);

    await notifyAdminError(
      `🚨 3 ошибки подряд ${platform}${userTag}\n\n${errorMsg.slice(0, 150)}\n\nПроверьте логин/пароль. Авто-сбор приостановлен для этого источника.`
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

    authErrorCount.set(sourceId, 0);
  }
}


async function canWorkNow(): Promise<boolean> {
  if (!isRunning) { saveStatusToFile(); return false; }

  try {
    // Проверяем: есть ли хотя бы ОДИН включённый workspace
    const enabledCount = await db.settings.count({ where: { systemEnabled: true } });
    if (enabledCount === 0) {
      statusReason = "⏸ Выключена в настройках"; saveStatusToFile();
      return false;
    }

    statusReason = "✅ Активен (МСК)";
    return true;
  } catch (err) {
    console.error("[worker] Ошибка проверки:", err);
    statusReason = "✅ Активен (МСК)";
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
    const orderNum = lead.url?.match(/[?&]o=(\d+)/)?.[1];
    const orderText = orderNum ? `📋 Заказ №${orderNum}` : "";
    await sendLeadNotification(telegramChatId, {
      platform, platformColor: color, score: 0,
      title: lead.title, budget,
      url: lead.url,
      reasoning: [orderText, lead.description?.slice(0, 150) || "⚡ Новая заявка!"].filter(Boolean).join("\n"),
      description: lead.description?.slice(0, 200),
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
  if (s && !s.systemEnabled) { console.log(`[worker] ⏸ systemEnabled=false для ${source.platform} (${(source.config as Record<string, any>)?.login || "?"})`); return; }

  // Проверка расписания из БД
  if (s?.workDays && s?.workHoursStart && s?.workHoursEnd) {
    const now = moscowNow();
    const dow = String(now.getDay());
    if (!s.workDays.split(",").includes(dow)) { console.log("[worker] ⏸ выходной (день " + dow + ") для " + (source.config as any)?.login || "?"); return; }
    const mins = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = s.workHoursStart.split(":").map(Number);
    const [eh, em] = s.workHoursEnd.split(":").map(Number);
    if (mins < sh * 60 + sm || mins > eh * 60 + em) { const hint = mins < sh*60+sm ? "начнётся в "+s.workHoursStart : "закончился в "+s.workHoursEnd; console.log("[worker] ⏸ нерабочее время (" + hint + ") для " + (source.config as any)?.login || "?"); return; }
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

  // Проверка antiDetect режима — дополнительный пропуск для аккаунтов под риском
  const adCfg = (source.config as any)?.antiDetect || {};
  if (adCfg.mode === "stealth") {
    // Stealth: пропускаем 60% циклов дополнительно (редкие заходы)
    if (Math.random() < 0.6) {
      console.log(`[worker] 🕵️ ${source.platform} (${(config as any)?.login || '?'}): stealth-пропуск (60%)`);
      return;
    }
  }
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

      // Если 0 заявок уже 10 циклов подряд — уведомление
      const emptyKey = `empty-${source.id}`;
      const emptyCount = (authErrorCount.get(emptyKey) || 0) + 1;
      authErrorCount.set(emptyKey, emptyCount);
      if (emptyCount === 10) {
        await notifyAdminError(`🟡 0 заявок 10 циклов подряд\n\nИсточник: ${source.platform} (${((source.config as any)?.login || "?")})\n\nВозможно сессия истекла или нет новых заказов.`);
        authErrorCount.set(emptyKey, 0);
      }
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
      // Сбрасываем счётчик «нет новых заявок» для этого workspace
      if (newLeads.length > 0) {
        authErrorCount.set("no-leads-" + source.workspaceId, 0);
      }
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
          externalId: rawLead.externalId,
          title: rawLead.title,
          description: rawLead.description, budgetMin: rawLead.budgetMin,
          budgetMax: rawLead.budgetMax, url: rawLead.url,
          city: rawLead.city, author: rawLead.author, status: "new",
        },
      });

      // Глубокий просмотр для Pro (и фильтрация) — сначала deep scan, потом уведомление
      // ЛИМИТ: не более 3 deep scan за цикл (чтобы не создавать шквал запросов)
      let deepScanCount = 0;
      const MAX_DEEP_SCAN_PER_CYCLE = 3;
      const sub = await db.subscription.findFirst({ where: { workspaceId: source.workspaceId } });
      const isPro = sub?.plan === "pro" && sub?.status === "active";
      if (isPro && rawLead.url && rawLead.url.includes("?o=") && deepScanCount < MAX_DEEP_SCAN_PER_CYCLE) {
        deepScanCount++;
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

            // 🔥 Карточка горячего лида — все rich-данные
            if (s?.telegramChatId && s?.telegramToken && s?.telegramAlerts !== false) {
              const yearsOnPlatform = details.monthsOnPlatform ? Math.round(details.monthsOnPlatform / 12) : 0;
              await sendLeadNotification(s.telegramChatId, {
                platform: source.platform,
                platformColor: (source.color as string) || "#22c55e",
                score: 0, // обновится AI-скорингом позже
                title: rawLead.title,
                budget: rawLead.budgetMin ? `${rawLead.budgetMin} ₽` : (details.budgetRaw ? `${details.budgetRaw} ₽` : "бюджет не указан"),
                url: rawLead.url,
                reasoning: (details.fullDescription || rawLead.description || "").slice(0, 200).replace(/\n/g, " "),
                author: details.author,
                reviewCount: details.reviewCount || 0,
                yearsOnPlatform: yearsOnPlatform || 0,
                monthsOnPlatform: details.monthsOnPlatform || 0,
                clientRating: details.clientRating || 0,
                city: details.city,
                deadline: details.deadline,
                responsePrice: details.responsePrice,
                descriptionLength: (details.fullDescription || rawLead.description || "").length,
              }, s.telegramToken);
            }
          } catch (e) {
            console.error("[worker] Ошибка обновления после deep scan:", e);
          }
        }).catch(() => {});
      }

      if (apiKey) {
        analyzeLead(rawLead.title, rawLead.description, { 
          apiKey,
          signals: { 
            budgetMin: rawLead.budgetMin,
            descriptionLength: (rawLead.description || "").length,
          }
        })
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
              // Повторное уведомление с AI-скорингом (бот не хранит состояние — отправим обновлённую карточку)
              await sendLeadNotification(s.telegramChatId, { 
                platform: source.platform, 
                platformColor: (source.color as string) || "#22c55e", 
                score: analysis.score, 
                title: rawLead.title, 
                budget: analysis.budgetPrediction, 
                url: rawLead.url, 
                reasoning: analysis.reasoning,
                botProbability: analysis.botProbability,
              }, s.telegramToken);
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
    statusReason = "✅ Активен (МСК)";
    currentSource = null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    lastError = msg;
    statusReason = `❌ Ошибка: ${msg.slice(0, 40)}`;
    totalErrors++;
    console.error(`[worker] ❌ ${source.platform}: ${msg}`);
    await db.source.update({ where: { id: source.id }, data: { status: "error", lastError: msg.slice(0, 500) } });
    await logActivity("fetch_error", `${source.platform}: ${msg.slice(0, 200)}`, source.workspaceId);

    // При ошибке сессии — удаляем кеш чтобы заново залогиниться
    if (msg.includes("сессия истекла") || msg.includes("неверный логин") || msg.includes("неверный пароль")) {
      try { sessionCache.delete(source.id); } catch {}
      // Отправляем отчет об ошибке админу сразу
      await notifyAdminError(
        `🔐 Profi отклонил вход ${((source.config as any)?.login || source.platform)}\n\n${msg.slice(0, 200)}\n\nБраузер перезапущен, пробуем заново.`
      );
    }

    // Сброс счётчика при успехе (выше)
    // При ошибке авторизации — инкремент
    if (msg.includes("логин") || msg.includes("парол") || msg.includes("вход") || msg.includes("login") || msg.includes("auth") || msg.includes("неверный")) {
      await handleAuthError(source.id, source.platform, msg, s, ((source.config as any)?.login || "?"));
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

// ─── Режим ждуна — запуск для источника ──────────────────────────────────

let watchInitialized = false;
(globalThis as any).__watchActive = false;
let lastKnownWatchLeadTime = Date.now();

// Callbacks для ждуна
function makeWatchCallbacks(sourceId: string, platform: string, login: string, workspaceSettings: any, apiKey: string, keywords: string): WatchCallbacks {
  return {
    onLead: async (lead) => {
      try {
        const existing = await db.lead.findFirst({
          where: { externalId: lead.externalId, sourceId: sourceId }
        });
        if (existing) {
          console.log(`[worker] 👀 дубль: ${lead.title?.slice(0, 30)}`);
          return;
        }

        const newLead = await db.lead.create({
          data: {
            workspaceId: (await db.source.findUnique({ where: { id: sourceId } }))?.workspaceId || "",
            sourceId,
            externalId: lead.externalId,
            title: lead.title,
            description: lead.description,
            budgetMin: lead.budgetMin,
            url: lead.url,
            createdAt: new Date(lead.createdAt),
          },
        });

        totalLeadsCollected++;
        lastKnownWatchLeadTime = Date.now();
        console.log(`[worker] 👀 Новая заявка от ждуна: ${lead.title?.slice(0, 40)}`);

        // Deep scan в фоне для rich-данных
        if (lead.url && lead.url.includes("?o=")) {
          scrapeOrderPage(sourceId, lead.url).then(async (details) => {
            if (!details) return;
            await db.lead.update({ where: { id: newLead.id }, data: {
              author: details.author, reviewCount: details.reviewCount,
              city: details.city, clientRating: details.clientRating,
              description: details.fullDescription || lead.description,
              metadata: { monthsOnPlatform: details.monthsOnPlatform, deadline: details.deadline },
            }});
            // Обновлённое Telegram с rich-данными
            if (workspaceSettings?.telegramChatId && workspaceSettings?.telegramToken) {
              await sendLeadNotification(workspaceSettings.telegramChatId, {
                platform, platformColor: "#22c55e", score: 0,
                title: lead.title || "", budget: lead.budgetMin ? `${lead.budgetMin} ₽` : "бюджет не указан",
                url: lead.url,
                reasoning: (details.fullDescription || lead.description || "").slice(0, 200),
                author: details.author,
                reviewCount: details.reviewCount || 0,
                monthsOnPlatform: details.monthsOnPlatform || 0,
                clientRating: details.clientRating || 0,
                city: details.city,
                deadline: details.deadline,
                responsePrice: details.responsePrice,
              }, workspaceSettings.telegramToken);
            }
          }).catch(() => {});
        }

        // Быстрое Telegram без богатых данных (придёт первым)
        if (workspaceSettings?.telegramChatId && workspaceSettings?.telegramToken) {
          await sendLeadNotification(workspaceSettings.telegramChatId, {
            platform, platformColor: "#22c55e", score: 0,
            title: lead.title || "", budget: lead.budgetMin ? `${lead.budgetMin} ₽` : "бюджет не указан",
            url: lead.url,
            reasoning: lead.description?.slice(0, 200) || "⚡ Новая заявка!",
          }, workspaceSettings.telegramToken);
        }

        await logActivity("watch_lead", `👀 Новая заявка: ${lead.title?.slice(0, 50)}`);
      } catch (err) {
        console.error("[worker] ❌ Ошибка сохранения заявки от ждуна:", err);
      }
    },
    onError: async (error) => {
      console.error(`[worker] ❌ Ждун ошибка ${login}: ${error}`);
      lastError = error;
      statusReason = `❌ Ошибка ждуна: ${error.slice(0, 40)}`;
      await notifyAdminError(`👀 Ждун ${login}: ${error}`);
    },
    onStatus: (status) => {
      statusReason = status;
      console.log(`[worker] 👀 ${login}: ${status}`);
      // При старте ждуна — Telegram уведомление админу
      if (status.includes("запущен") || status.includes("Слежу")) {
        notifyAdminError(`👀 Ждун ${login}: запущен
Режим: проверка каждые 3-8 мин
Ночной стоп: 00:00-07:00 МСК`);
      }
    },
  };
}

async function initWatchers() {
  if (watchInitialized) return;
  watchInitialized = true;
  (globalThis as any).__watchActive = true;

  try {
    const watchSources = await db.source.findMany({
      where: {
        enabled: true,
        // Проверяем mode="watch" через JSON
        // Используем фильтр по конфигу
      },
      include: { workspace: { include: { settings: true } } },
    });

    // Фильтруем через код
    for (const source of watchSources) {
      const config = source.config as Record<string, any> || {};
      if (config.mode !== "watch") continue;
      
      const apiKey = source.workspace.settings?.openrouterKey || "";
      const keywords = source.workspace.settings?.keywords || "";
      const s = source.workspace.settings;

      console.log(`[worker] 👀 Запуск ждуна для ${config.login || source.platform}`);
      
      startWatching(
        source.id,
        config,
        keywords,
        makeWatchCallbacks(source.id, source.platform, config.login || "?", s, apiKey, keywords),
        s?.workHoursStart || undefined,
        s?.workHoursEnd || undefined
      );
    }
  } catch (err) {
    console.error("[worker] ❌ Ошибка инициализации ждуна:", err);
  }
}

// ─── Основной цикл ────────────────────────────────────────────────────────

let lastKnownInterval = 0;

async function pollAllSources() {
  // CHECK WATCHER FALLBACK: если ждун упал, циклический сбор подхватывает
  // Если watch был запущен, но нет новых leads от ждуна > 30 мин — включаем циклы
  if (watchInitialized) {
    const lastWatchLeadMs = totalLeadsCollected > 0 ? Date.now() - (lastKnownWatchLeadTime || 0) : null;
    // Если ждун жив но давно не приносил заявок — всё ок, может нет новых заказов
  }
  // Интервал теперь всегда случайный из пула — не читаем из БД
  if (!(await canWorkNow())) return;

  // Ночной режим: проверяем раз в 2-3 часа, не чаще
  if (isNightTime()) {
    const now = moscowNow();
    console.log(`[worker] 🌙 Ночной режим (${now.getUTCHours()}:00 МСК) — проверка раз в 2-3 часа`);
    statusReason = `Ночной режим (МСК ${now.getUTCHours()}:00)`;
    saveStatusToFile();
  }

  // В нерабочие часы — большие паузы
  if (!isWorkingHours() && !isNightTime()) {
    const now = moscowNow();
    console.log(`[worker] 🕐 Нерабочее время (${now.getUTCHours()}:00 МСК) — увеличенный интервал`);
    statusReason = `Нерабочее время (МСК ${now.getUTCHours()}:00)`;
    saveStatusToFile();
  }

  // Случайный пропуск — имитация «занят/отошёл»
  if (shouldSkipThisCycle()) {
    console.log(`[worker] 🎲 Пропуск цикла (имитация «занят»)`);
    statusReason = "Ожидание след. цикла (пропуск 20%)";
    saveStatusToFile();
    return;
  }

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
      console.log(`[worker] ✅ Источник ${source.platform}(${(source.config as Record<string, any>)?.login || "?" || '?'}) завершён`);
    }).catch(err => {
      console.error(`[worker] ❌ Ошибка источника ${source.platform}(${(source.config as Record<string, any>)?.login || "?" || '?'}):`, err.message || err);
    })
  ));

  // Проверка: workspace без новых заявок > 2 часов
  try {
    const allWs = await db.workspace.findMany({ where: { sources: { some: { enabled: true } } }, include: { user: true, settings: true } });
    for (const ws of allWs) {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const recentLeads = await db.lead.count({ where: { workspaceId: ws.id, createdAt: { gte: twoHoursAgo } } });
      if (recentLeads === 0) {
        const noLeadKey = "no-leads-" + ws.id;
        const noLeadCount = (authErrorCount.get(noLeadKey) || 0) + 1;
        authErrorCount.set(noLeadKey, noLeadCount);
        if (noLeadCount === 1) {
          await notifyAdminError(
            `🟡 Нет новых заявок > 2 часов\n\nПартнёр: ${ws.user?.email || "?"}\nАккаунт Profi: ${ws.sources[0]?.config?.login || "?"}\n\nПроверьте подключение в админке.`
          );
        }
      }
    }
  } catch {}

  saveStatusToFile();
  console.log(`[worker] ✅ Цикл #${totalCycles} завершён (собрано: ${totalLeadsCollected})\n`);
}

// ─── Запуск ───────────────────────────────────────────────────────────────

// Проверка подписок каждый час
  setInterval(checkSubscriptions, 60 * 60 * 1000);

  export function startScheduler(intervalMs?: number) {
  if (isRunning) return;
  isRunning = true;
  initWatchers();
  startupTime = startupTime || new Date();

  console.log(`🚀 Worker запущен (опрос: случайный — ${RANDOM_INTERVAL_POOL.join(', ')} мин)`);
  console.log(`🕐 Режим: случайный интервал (${RANDOM_INTERVAL_POOL.join('/')} мин), 8:00-22:00 МСК, ночью — раз в 2-3 часа`);
  console.log(`📱 Telegram: мгновенные + ошибки админу`);
  console.log(`📋 Журнал: все события в activity_log`);
  console.log(`🎭 Анти-детект: случайный интервал, пропуски 20%, человеческое поведение`);

  logActivity("worker_start", `Worker запущен (случайный интервал: ${RANDOM_INTERVAL_POOL.join('/')} мин)`);

  // 💚 Запуск пульса — умные оповещения по расписанию
  const pulseInterval = setInterval(() => {
    pulseCheck(
      process.env.TELEGRAM_BOT_TOKEN || "8924588782:AAGalvqpkASuXy2ZgmtlApk5W1HRxHKnmrg",
      process.env.TELEGRAM_ADMIN_CHAT_ID || "778784292"
    ).catch(() => {});
  }, 60000); // проверка каждую минуту (сам решит что отправить)

  // 🚀 Стартовое уведомление
  setTimeout(() => {
    notifyStart(
      process.env.TELEGRAM_BOT_TOKEN || "8924588782:AAGalvqpkASuXy2ZgmtlApk5W1HRxHKnmrg",
      process.env.TELEGRAM_ADMIN_CHAT_ID || "778784292"
    ).catch(() => {});
  }, 3000);

  // Первый запуск со случайной задержкой 1-10 сек
  const firstDelay = 1000 + Math.random() * 9000;
  setTimeout(() => pollAllSources(), firstDelay);
  
  // Рекурсивный планировщик — каждый раз случайный интервал из пула
  function scheduleNext() {
    if (!isRunning) return;
    let nextMs: number;
    if (isNightTime()) {
      nextMs = getNightIntervalMs();
    } else {
      nextMs = getRandomIntervalMs();
    }
    const nextMin = Math.round(nextMs / 60000);
    const nextSec = Math.round((nextMs % 60000) / 1000);
    if (nextMin >= 60) {
      console.log(`[worker] ⏰ Следующий опрос через ${nextMin} мин (${Math.round(nextMin/60*10)/10} ч)`);
    } else {
      console.log(`[worker] ⏰ Следующий опрос через ${nextMin} мин ${nextSec} сек`);
    }
    intervalId = setTimeout(() => {
      pollAllSources().finally(() => scheduleNext());
    }, nextMs);
  }
  scheduleNext();

  autoCleanup();
  checkSubscriptions();
  cleanupIntervalId = setInterval(autoCleanup, 60 * 60 * 1000);
}

export function stopScheduler() {
  isRunning = false;
  if (intervalId) { clearTimeout(intervalId); intervalId = null; }
  if (cleanupIntervalId) { clearInterval(cleanupIntervalId); cleanupIntervalId = null; }
  notifyStop(
    process.env.TELEGRAM_BOT_TOKEN || "8924588782:AAGalvqpkASuXy2ZgmtlApk5W1HRxHKnmrg",
    process.env.TELEGRAM_ADMIN_CHAT_ID || "778784292"
  ).catch(() => {});
  logActivity("worker_stop", "Worker остановлен");
  console.log("⏸ Worker остановлен");
}

// Перезапуск — интервал теперь всегда случайный из пула
export async function restartScheduler() {
  stopScheduler();
  startScheduler();
}

// СТАРТ ТОЛЬКО ЧЕРЕЗ worker-run.ts (PM2 процесс)
// Не запускаем здесь — иначе web-процесс создаст второй воркер

process.on("SIGINT", () => { stopScheduler(); process.exit(0); });
process.on("SIGTERM", () => { stopScheduler(); process.exit(0); });
