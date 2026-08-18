import { db } from "@/lib/db";
import type { Subscription } from "@prisma/client";
import { PERIOD_DAYS, addDays, asBillingMode, reportFromSub, pricesFromConfig } from "./operator-pricing";
import { getAppConfig } from "@/lib/config/app";

const ADMIN_CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID || "";
const ADMIN_BOT = process.env.TELEGRAM_BOT_TOKEN || "";
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  collectionEnabled: boolean;
  expired: boolean;
  expiresAt: string | null;
  reason?: string;
}

async function sendTelegram(chatId: string, token: string, text: string): Promise<void> {
  if (!chatId || !token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(() => {});
}

function isExpired(sub: Subscription): boolean {
  if (asBillingMode(sub.billingMode) === "unlimited") return false;
  if (asBillingMode(sub.billingMode) === "paused") return false;
  if (!sub.expiresAt) return false;
  return sub.expiresAt.getTime() < Date.now();
}

function maybeRollPeriod(sub: Subscription): Subscription {
  const start = sub.quotaPeriodStart;
  if (!start || Date.now() - start.getTime() >= MONTH_MS) {
    return {
      ...sub,
      leadsUsedMonth: 0,
      quotaPeriodStart: new Date(),
    };
  }
  return sub;
}

export async function getSubscription(workspaceId: string): Promise<Subscription | null> {
  let sub = await db.subscription.findFirst({ where: { workspaceId } });
  if (!sub) return null;

  const rolled = maybeRollPeriod(sub);
  if (
    rolled.leadsUsedMonth !== sub.leadsUsedMonth ||
    rolled.quotaPeriodStart?.getTime() !== sub.quotaPeriodStart?.getTime()
  ) {
    sub = await db.subscription.update({
      where: { id: sub.id },
      data: {
        leadsUsedMonth: rolled.leadsUsedMonth,
        quotaPeriodStart: rolled.quotaPeriodStart,
      },
    });
  }
  return sub;
}

export function quotaStatusFromSub(sub: Subscription | null): QuotaStatus {
  if (!sub) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      remaining: 0,
      collectionEnabled: false,
      expired: true,
      expiresAt: null,
      reason: "no_subscription",
    };
  }

  const rolled = maybeRollPeriod(sub);
  const expired = isExpired(sub);
  const paused = asBillingMode(sub.billingMode) === "paused";
  const used = rolled.leadsUsedMonth;
  const limit = sub.leadsPerMonth;
  const atLimit = used >= limit;
  const collectionEnabled = sub.collectionEnabled && !expired && !paused && !atLimit;

  let reason: string | undefined;
  if (paused) reason = "paused";
  else if (expired) reason = "expired";
  else if (!sub.collectionEnabled) reason = "disabled";
  else if (atLimit) reason = "quota_exceeded";

  return {
    allowed: collectionEnabled,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    collectionEnabled: sub.collectionEnabled,
    expired,
    expiresAt: sub.expiresAt?.toISOString() || null,
    reason,
  };
}

export async function getQuotaStatus(workspaceId: string): Promise<QuotaStatus> {
  const sub = await getSubscription(workspaceId);
  return quotaStatusFromSub(sub);
}

export async function haltCollection(
  workspaceId: string,
  reason: "quota_exceeded" | "expired" | "disabled",
): Promise<void> {
  const sub = await db.subscription.findFirst({ where: { workspaceId } });
  if (!sub) return;

  await db.subscription.update({
    where: { id: sub.id },
    data: { collectionEnabled: false },
  });

  await db.source.updateMany({
    where: { workspaceId },
    data: { enabled: false, status: reason === "quota_exceeded" ? "paused" : "disabled" },
  });

  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      user: { select: { email: true, firstName: true } },
      settings: true,
      sources: { select: { config: true } },
    },
  });

  const email = ws?.user?.email || workspaceId;
  const name = ws?.user?.firstName || email;
  const profiLogin = (ws?.sources[0]?.config as { login?: string })?.login || "—";
  const used = sub.leadsUsedMonth;
  const limit = sub.leadsPerMonth;

  const reasonText =
    reason === "quota_exceeded"
      ? `Лимит заявок исчерпан: <b>${used}/${limit}</b>`
      : reason === "expired"
        ? "Срок оплаты истёк"
        : "Сбор остановлен администратором";

  const adminText = [
    "⛔ <b>Сбор остановлен</b>",
    `Партнёр: ${name} (${email})`,
    `Profi: ${profiLogin}`,
    reasonText,
    "Включите в админке → Счета",
  ].join("\n");

  if (ADMIN_BOT && ADMIN_CHAT) {
    await sendTelegram(ADMIN_CHAT, ADMIN_BOT, adminText);
  }

  const partnerChat = ws?.settings?.telegramChatId;
  const partnerToken = ws?.settings?.telegramToken;
  if (partnerChat && partnerToken) {
    const partnerText = [
      "⛔ <b>Сбор заявок остановлен</b>",
      reasonText,
      "Для продления обратитесь к оператору сервиса.",
    ].join("\n");
    await sendTelegram(partnerChat, partnerToken, partnerText);
  }
}

/** Increment counter after a new lead; halt if limit reached */
export async function recordNewLead(workspaceId: string): Promise<QuotaStatus> {
  const sub = await getSubscription(workspaceId);
  if (!sub) return quotaStatusFromSub(null);

  const status = quotaStatusFromSub(sub);
  if (!status.allowed) return status;

  const newUsed = sub.leadsUsedMonth + 1;
  await db.subscription.update({
    where: { id: sub.id },
    data: { leadsUsedMonth: newUsed },
  });

  if (newUsed >= sub.leadsPerMonth) {
    await haltCollection(workspaceId, "quota_exceeded");
    return {
      ...status,
      used: newUsed,
      remaining: 0,
      allowed: false,
      reason: "quota_exceeded",
    };
  }

  return {
    ...status,
    used: newUsed,
    remaining: Math.max(0, sub.leadsPerMonth - newUsed),
  };
}

/** Check before accepting leads batch */
export async function assertCollectionAllowed(workspaceId: string): Promise<QuotaStatus> {
  const sub = await getSubscription(workspaceId);
  const status = quotaStatusFromSub(sub);

  if (!status.allowed && sub) {
    if (status.reason === "expired") await haltCollection(workspaceId, "expired");
    else if (status.reason === "quota_exceeded") await haltCollection(workspaceId, "quota_exceeded");
  }

  return status;
}

export async function renewPartnerMonth(
  workspaceId: string,
  leadsPerMonth?: number,
): Promise<Subscription> {
  const sub = await db.subscription.findFirst({ where: { workspaceId } });
  const now = new Date();
  const from = sub?.expiresAt && sub.expiresAt.getTime() > now.getTime() ? sub.expiresAt : now;
  const expiresAt = addDays(from, PERIOD_DAYS);
  const data = {
    status: "active",
    plan: "pro",
    billingMode: "monthly",
    pausedAt: null as Date | null,
    periodStart: from,
    expiresAt,
    leadsUsedMonth: 0,
    quotaPeriodStart: from,
    collectionEnabled: true,
    connectFeePaid: true,
    periodPaid: true,
    periodPaidAt: now,
    periodIndex: sub ? (sub.periodIndex || 1) + 1 : 1,
    ...(leadsPerMonth ? { leadsPerMonth } : {}),
  };

  let updated: Subscription;
  if (sub) {
    const prevStart = sub.periodStart || sub.quotaPeriodStart || sub.createdAt;
    const prevEnd = sub.expiresAt || addDays(prevStart, PERIOD_DAYS);
    const prevReport = reportFromSub(sub);
    await upsertInvoice({
      workspaceId,
      periodStart: prevStart,
      periodEnd: prevEnd,
      amountRub: prevReport.accruedNow,
      paid: true,
    });
    updated = await db.subscription.update({ where: { id: sub.id }, data });
  } else {
    const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
    updated = await db.subscription.create({
      data: {
        workspaceId,
        userId: ws?.userId,
        leadsPerMonth: leadsPerMonth || 500,
        ...data,
      },
    });
  }

  await db.source.updateMany({
    where: { workspaceId },
    data: { enabled: true, status: "active" },
  });

  return updated;
}

export async function pausePartnerBilling(workspaceId: string): Promise<Subscription | null> {
  const sub = await db.subscription.findFirst({ where: { workspaceId } });
  if (!sub) return null;
  if (asBillingMode(sub.billingMode) === "paused") return sub;
  const updated = await db.subscription.update({
    where: { id: sub.id },
    data: {
      billingMode: "paused",
      pausedAt: new Date(),
      collectionEnabled: false,
    },
  });
  await db.source.updateMany({
    where: { workspaceId },
    data: { enabled: false, status: "paused" },
  });
  return updated;
}

export async function resumePartnerBilling(workspaceId: string): Promise<Subscription | null> {
  const sub = await db.subscription.findFirst({ where: { workspaceId } });
  if (!sub) return null;
  const now = new Date();
  let periodStart = sub.periodStart || sub.quotaPeriodStart || sub.createdAt;
  let expiresAt = sub.expiresAt;
  if (sub.pausedAt) {
    const pauseMs = now.getTime() - sub.pausedAt.getTime();
    periodStart = new Date(periodStart.getTime() + pauseMs);
    if (expiresAt) expiresAt = new Date(expiresAt.getTime() + pauseMs);
  }
  const updated = await db.subscription.update({
    where: { id: sub.id },
    data: {
      billingMode: "monthly",
      pausedAt: null,
      periodStart,
      expiresAt,
      collectionEnabled: true,
      status: "active",
    },
  });
  await db.source.updateMany({
    where: { workspaceId },
    data: { enabled: true, status: "active" },
  });
  return updated;
}

export async function setUnlimitedBilling(workspaceId: string): Promise<Subscription | null> {
  const sub = await db.subscription.findFirst({ where: { workspaceId } });
  if (!sub) return null;
  const updated = await db.subscription.update({
    where: { id: sub.id },
    data: {
      billingMode: "unlimited",
      pausedAt: null,
      collectionEnabled: true,
      status: "active",
    },
  });
  await db.source.updateMany({
    where: { workspaceId },
    data: { enabled: true, status: "active" },
  });
  return updated;
}

export async function setCollectionEnabled(workspaceId: string, enabled: boolean): Promise<void> {
  const sub = await db.subscription.findFirst({ where: { workspaceId } });
  if (!sub) return;

  await db.subscription.update({
    where: { id: sub.id },
    data: { collectionEnabled: enabled },
  });

  if (enabled) {
    const status = quotaStatusFromSub(await getSubscription(workspaceId));
    if (status.allowed) {
      await db.source.updateMany({
        where: { workspaceId },
        data: { enabled: true, status: "active" },
      });
    }
  } else {
    await db.source.updateMany({
      where: { workspaceId },
      data: { enabled: false, status: "disabled" },
    });
  }
}

export async function createPartnerSubscription(
  workspaceId: string,
  userId: string,
  leadsPerMonth: number,
): Promise<Subscription> {
  const now = new Date();
  const prices = pricesFromConfig(await getAppConfig());
  return db.subscription.create({
    data: {
      workspaceId,
      userId,
      plan: "pro",
      status: "active",
      leadsPerMonth: leadsPerMonth || 500,
      leadsUsedMonth: 0,
      quotaPeriodStart: now,
      periodStart: now,
      collectionEnabled: true,
      billingMode: "monthly",
      connectFeePaid: false,
      periodPaid: false,
      periodIndex: 1,
      connectFeeRub: prices.connectFeeRub,
      aiApiRub: prices.aiApiRub,
      aiApiUsd: prices.aiApiUsd,
      supportFeeRub: prices.supportFeeRub,
      vpsPerDayRub: prices.vpsPerDayRub,
      expiresAt: addDays(now, PERIOD_DAYS),
      leadsPerDay: 999999,
      sourcesLimit: 5,
      aiAnalysis: true,
      aiResponses: true,
      telegramAlerts: true,
    },
  });
}

async function upsertInvoice(input: {
  workspaceId: string;
  periodStart: Date;
  periodEnd: Date;
  amountRub: number;
  paid: boolean;
}) {
  const paidAt = input.paid ? new Date() : null;
  const t = input.periodStart.getTime();
  const existing = await db.billingInvoice.findFirst({
    where: {
      workspaceId: input.workspaceId,
      periodStart: { gte: new Date(t - 60_000), lte: new Date(t + 60_000) },
    },
  });
  if (existing) {
    return db.billingInvoice.update({
      where: { id: existing.id },
      data: {
        periodEnd: input.periodEnd,
        amountRub: input.amountRub,
        paid: input.paid,
        paidAt,
      },
    });
  }
  return db.billingInvoice.create({
    data: {
      workspaceId: input.workspaceId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      amountRub: input.amountRub,
      paid: input.paid,
      paidAt,
    },
  });
}

export async function setPeriodPaid(
  workspaceId: string,
  paid: boolean,
  periodIso?: string,
): Promise<Subscription | null> {
  const sub = await db.subscription.findFirst({ where: { workspaceId } });
  if (!sub) return null;
  const currentStart = sub.periodStart || sub.quotaPeriodStart || sub.createdAt;
  const targetStart = periodIso ? new Date(periodIso) : currentStart;
  const isCurrent = Math.abs(targetStart.getTime() - currentStart.getTime()) < 60 * 1000;
  const report = reportFromSub(sub);
  const periodEnd = isCurrent
    ? (sub.expiresAt || addDays(targetStart, PERIOD_DAYS))
    : addDays(targetStart, PERIOD_DAYS);
  const amountRub = isCurrent
    ? report.accruedNow
    : report.aiApiRub + report.supportFeeRub + report.vpsPerDayRub * PERIOD_DAYS;

  await upsertInvoice({
    workspaceId,
    periodStart: targetStart,
    periodEnd,
    amountRub,
    paid,
  });

  if (!isCurrent) return sub;

  return db.subscription.update({
    where: { id: sub.id },
    data: {
      periodPaid: paid,
      periodPaidAt: paid ? new Date() : null,
      connectFeePaid: paid ? true : sub.connectFeePaid,
    },
  });
}
