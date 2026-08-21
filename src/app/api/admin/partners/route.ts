// POST /api/admin/partners — создать партнёра с полным конфигом
// Возвращает setup-команду для VPS

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hash } from "bcryptjs";
import { createPartnerSubscription } from "@/lib/billing/quota";
import { reportFromSub } from "@/lib/billing/operator-pricing";
import { requireAdminUser } from "@/lib/admin/guard";
import { buildAccessCard, setupCommandFor } from "@/lib/admin/access-card";
import { isActiveAgentError } from "@/lib/agent/stale-error";
import { resolvePollRange } from "@/lib/agent/poll-interval";
import {
  TELEGRAM_ATTEMPT_ACTIVITY,
  TELEGRAM_DELIVERY_ACTIVITY,
} from "@/lib/telegram/delivery";
import type { Prisma } from "@prisma/client";


// GET — список партнёров (пароли не отдаём)
export async function GET() {
  const guard = await requireAdminUser();
  if (guard.error) return guard.error;

  const partners = await db.user.findMany({
    where: { role: "user" },
    include: {
      workspaces: { include: { sources: true, settings: true, _count: { select: { leads: true } } } },
      subscription: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const todayMsk = new Date(Date.now() + 3 * 3600 * 1000);
  todayMsk.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date(todayMsk.getTime() - 3 * 3600 * 1000);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 3600 * 1000);

  const [todayCounts, yesterdayCounts, lastLeads] = await Promise.all([
    db.lead.groupBy({
      by: ["workspaceId"],
      where: { createdAt: { gte: todayStart } },
      _count: { _all: true },
    }),
    db.lead.groupBy({
      by: ["workspaceId"],
      where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
      _count: { _all: true },
    }),
    db.lead.findMany({
      where: {
        workspaceId: {
          in: partners.flatMap((p) => p.workspaces.map((w) => w.id)),
        },
      },
      orderBy: { createdAt: "desc" },
      distinct: ["workspaceId"],
      select: {
        workspaceId: true,
        createdAt: true,
        title: true,
      },
    }),
  ]);
  const todayMap = new Map(todayCounts.map((c) => [c.workspaceId, c._count._all]));
  const yesterdayMap = new Map(
    yesterdayCounts.map((c) => [c.workspaceId, c._count._all]),
  );
  const lastLeadMap = new Map(lastLeads.map((lead) => [lead.workspaceId, lead]));
  const tgCounts = await db.activityLog.groupBy({
    by: ["workspaceId", "type"],
    where: {
      type: { in: [TELEGRAM_ATTEMPT_ACTIVITY, TELEGRAM_DELIVERY_ACTIVITY] },
      createdAt: { gte: todayStart },
    },
    _count: { _all: true },
  });
  const tgDeliveredMap = new Map(
    tgCounts
      .filter((c) => c.type === TELEGRAM_DELIVERY_ACTIVITY)
      .map((c) => [c.workspaceId, c._count._all]),
  );
  const tgAttemptedMap = new Map(
    tgCounts
      .filter((c) => c.type === TELEGRAM_ATTEMPT_ACTIVITY)
      .map((c) => [c.workspaceId, c._count._all]),
  );

  return NextResponse.json({ partners: partners.map(p => {
    const ws = p.workspaces[0];
    return {
      id: p.id, email: p.email, name: p.firstName,
      role: p.role, createdAt: p.createdAt,
      subscription: p.subscription ? {
        plan: p.subscription.plan,
        status: p.subscription.status,
        leadsPerMonth: p.subscription.leadsPerMonth,
        leadsUsedMonth: p.subscription.leadsUsedMonth,
        collectionEnabled: p.subscription.collectionEnabled,
        expiresAt: p.subscription.expiresAt?.toISOString() || null,
        createdAt: p.subscription.createdAt.toISOString(),
        billing: reportFromSub(p.subscription, p.createdAt),
      } : null,
      workspace: ws ? {
        id: ws.id, name: ws.name,
        sources: ws.sources.map(s => {
          const cfg = (s.config as any) || {};
          const poll = resolvePollRange(cfg);
          const liveError = s.lastError || cfg._lastError || null;
          const archivedStored = cfg._lastErrorArchived || null;
          const errorActive = isActiveAgentError({
            lastError: liveError,
            lastErrorTime: cfg._lastErrorTime || null,
            circuitBreakerState: cfg._circuitBreaker?.state || null,
            lastLoginAt: cfg._lastLoginAt || null,
            leadsCollected: (cfg._agentLeads || 0) || todayMap.get(ws.id) || 0,
          });
          return {
            id: s.id, platform: s.platform, enabled: s.enabled,
            lastCheckAt: s.lastCheckAt, status: s.status || "active",
            lastError: errorActive ? liveError : null,
            lastErrorArchived: errorActive ? null : liveError || archivedStored || null,
            config: {
              login: cfg.login || null,
              password: cfg.password ? "●●●●" : null,
              _profiConfigured: !!(cfg.login && cfg.password),
              _vpsIp: cfg._vpsIp || null,
              _onboardingVpsReady: cfg._onboardingVpsReady || false,
              _onboardingNotes: cfg._onboardingNotes || null,
              workHoursStart: cfg.workHoursStart || "08:00",
              workHoursEnd: cfg.workHoursEnd || "22:00",
              pollPreset: poll.preset,
              pollMinMinutes: poll.minMinutes,
              pollMaxMinutes: poll.maxMinutes,
              _lastLoginAt: cfg._lastLoginAt || null,
            },
            agentStatus: {
              online: cfg._lastHeartbeat ? (Date.now() - new Date(cfg._lastHeartbeat).getTime() < 15*60*1000) : false,
              lastHeartbeat: cfg._lastHeartbeat || null,
              uptime: cfg._agentUptime || 0,
              memory: cfg._agentMemory || 0,
              leads: cfg._agentLeads || 0,
              errors: cfg._agentErrors || 0,
              lastError: errorActive ? liveError : null,
              lastErrorArchived: errorActive ? null : liveError || archivedStored || null,
              lastErrorTime: cfg._lastErrorTime || null,
              lifecycle: cfg._agentState || "pending",
              circuitBreaker: cfg._circuitBreaker || null,
              version: cfg._agentVersion || 1,
              checkIntervalLabel: poll.label,
            },
            setupCommand: setupCommandFor(s.id),
          };
        }),
        settings: ws.settings ? {
          keywords: ws.settings.keywords,
          telegramChatId: ws.settings.telegramChatId,
          telegramToken: ws.settings.telegramToken,
        } : null,
        leadsCount: ws._count.leads,
        leadsToday: todayMap.get(ws.id) || 0,
        leadsYesterday: yesterdayMap.get(ws.id) || 0,
        lastLead: lastLeadMap.get(ws.id)
          ? {
              title: lastLeadMap.get(ws.id)?.title || "Без названия",
              createdAt: lastLeadMap.get(ws.id)?.createdAt.toISOString(),
            }
          : null,
        telegramDeliveredToday: tgDeliveredMap.get(ws.id) || 0,
        telegramAttemptedToday: tgAttemptedMap.get(ws.id) || 0,
      } : null,
    };
  }) });
}

// POST — создать партнёра + source + вернуть карточку доступа
export async function POST(req: NextRequest) {
  const guard = await requireAdminUser();
  if (guard.error) return guard.error;

  const body = await req.json();
  const {
    // Пользователь
    email, password, name,
    // Profi
    profiLogin, profiPassword,
    // Фильтры
    keywords, minusKeywords,
    titleKeywords, titleMinusKeywords,
    budgetMin, budgetMax,
    // Режим
    antiDetectMode, workHoursStart, workHoursEnd,
    // Telegram
    telegramChatId, telegramToken,
    // Billing + VPS
    leadsPerMonth, vpsIp,
  } = body;

  if (!email || !password) return NextResponse.json({ error: "email and password required" }, { status: 400 });

  // Проверяем существование
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Пользователь с таким email уже существует" }, { status: 409 });

  // Создаём пользователя
  const passwordHash = await hash(password, 12);
  const partner = await db.user.create({
    data: { email, passwordHash, firstName: name || email.split("@")[0], role: "user" },
  });

  // Создаём workspace
  const ws = await db.workspace.create({
    data: { userId: partner.id, name: name || email.split("@")[0], slug: `ws-${partner.id.slice(0, 8)}` },
  });

  // Создаём settings
  await db.settings.create({
    data: {
      workspaceId: ws.id,
      keywords: keywords || "",
      minusKeywords: minusKeywords || "",
      budgetMin: budgetMin || 3000,
      budgetMax: budgetMax || 500000,
      telegramChatId: telegramChatId || null,
      telegramToken: telegramToken || null,
    },
  });

  await createPartnerSubscription(ws.id, partner.id, parseInt(String(leadsPerMonth)) || 500);

  let sourceId: string | null = null;

  // Подключаем Profi если есть логин
  if (profiLogin && profiPassword) {
    const antiDetect = antiDetectMode === "stealth"
      ? { mode: "stealth", delayMultiplier: 1.5, disableDeepScan: false, extraSkipPercent: 0 }
      : antiDetectMode === "balanced"
      ? { mode: "balanced", delayMultiplier: 1.0, disableDeepScan: false, extraSkipPercent: 0 }
      : { mode: "light" };

    const sourceConfig: Record<string, unknown> = {
      mode: "watch",
      login: profiLogin,
      password: profiPassword,
      _hubPassword: password,
      keywords: keywords || "",
      minusKeywords: minusKeywords || "",
      titleKeywords: titleKeywords || "",
      titleMinusKeywords: titleMinusKeywords || "",
      budgetMin: budgetMin || null,
      budgetMax: budgetMax || null,
      antiDetect,
      workHoursStart: workHoursStart || "08:00",
      workHoursEnd: workHoursEnd || "22:00",
      proxy: null,
    };
    if (vpsIp) {
      sourceConfig._vpsIp = vpsIp;
      sourceConfig._onboardingVpsReady = true;
    }

    const source = await db.source.create({
      data: {
        workspaceId: ws.id,
        platform: "profi", name: "Profi.ru",
        enabled: true, color: "#22c55e", status: "pending",
        config: sourceConfig as Prisma.InputJsonValue,
      },
    });
    sourceId = source.id;
  }

  const setupCommand = setupCommandFor(sourceId);
  const accessCard = buildAccessCard({
    partnerId: partner.id,
    email,
    name: name || email.split("@")[0],
    hubPassword: password,
    sourceId,
    sourceConfig: {
      login: profiLogin || null,
      password: profiPassword || null,
      _vpsIp: vpsIp || null,
      workHoursStart: workHoursStart || "08:00",
      workHoursEnd: workHoursEnd || "22:00",
    },
    telegramChatId: telegramChatId || null,
    leadsPerMonth: parseInt(String(leadsPerMonth)) || 500,
  });

  return NextResponse.json({
    ok: true,
    partnerId: partner.id,
    workspaceId: ws.id,
    sourceId,
    setupCommand,
    partnerPassword: password,
    accessCard,
    setupInstructions: sourceId ? {
      title: "Команда для VPS партнёра",
      command: setupCommand,
      steps: [
        "1. Подключись к VPS: ssh root@IP_ПАРТНЁРА",
        "2. Выполни команду ниже",
        "3. Проверь: pm2 status (должен быть leads-agent-v2 online)",
      ],
    } : null,
  });
}
