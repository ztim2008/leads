/** Операторский счёт. Цены задаёт админ; VPS капает каждый прожитый день. */

export const DEFAULT_CONNECT_FEE_RUB = 5000;
export const DEFAULT_VPS_PER_DAY_RUB = 40;
export const DEFAULT_AI_API_RUB = 1700;
export const DEFAULT_AI_API_USD = 20;
export const DEFAULT_SUPPORT_FEE_RUB = 2000;
export const PERIOD_DAYS = 30;
export const DAY_MS = 24 * 60 * 60 * 1000;

export type BillingMode = "monthly" | "paused" | "unlimited";

export type OperatorPriceSheet = {
  connectFeeRub: number;
  aiApiRub: number;
  aiApiUsd: number;
  supportFeeRub: number;
  vpsPerDayRub: number;
};

export const DEFAULT_PRICES: OperatorPriceSheet = {
  connectFeeRub: DEFAULT_CONNECT_FEE_RUB,
  aiApiRub: DEFAULT_AI_API_RUB,
  aiApiUsd: DEFAULT_AI_API_USD,
  supportFeeRub: DEFAULT_SUPPORT_FEE_RUB,
  vpsPerDayRub: DEFAULT_VPS_PER_DAY_RUB,
};

export type BillingInput = {
  connectedAt: Date;
  periodStart: Date | null;
  expiresAt: Date | null;
  billingMode: BillingMode | string | null;
  pausedAt: Date | null;
  connectFeeRub?: number | null;
  vpsPerDayRub?: number | null;
  aiApiRub?: number | null;
  aiApiUsd?: number | null;
  supportFeeRub?: number | null;
  periodIndex?: number | null;
  connectFeePaid?: boolean | null;
  periodPaid?: boolean | null;
  periodPaidAt?: Date | null;
  now?: Date;
};

export type BillingReport = {
  connectedAt: string;
  periodStart: string | null;
  expiresAt: string | null;
  daysLeft: number | null;
  expired: boolean;
  paused: boolean;
  unlimited: boolean;
  mode: BillingMode;
  periodIndex: number;
  firstPeriod: boolean;
  vpsPerDayRub: number;
  vpsDays: number;
  vpsCost: number;
  vpsDaysAtEnd: number;
  vpsCostAtEnd: number;
  aiApiRub: number;
  aiApiUsd: number;
  supportFeeRub: number;
  supportDue: number;
  connectFeeRub: number;
  connectFeeDue: number;
  accruedNow: number;
  accruedAtEnd: number;
  dueNow: number;
  dueAtEnd: number;
  periodPaid: boolean;
  periodPaidAt: string | null;
  paidLabel: "оплачен" | "не оплачен";
  label: string;
};

export function asBillingMode(raw: string | null | undefined): BillingMode {
  if (raw === "paused" || raw === "unlimited") return raw;
  return "monthly";
}

export function daysLeftCeil(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / DAY_MS));
}

/** Сколько суток уже тикает счётчик (день старта = 1). */
export function daysUsed(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  if (ms <= 0) return 1;
  return Math.max(1, Math.ceil(ms / DAY_MS));
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

export function nInt(v: unknown, fallback: number): number {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function pricesFromConfig(cfg: {
  operatorConnectFeeRub?: number | null;
  operatorAiApiRub?: number | null;
  operatorAiApiUsd?: number | null;
  operatorSupportFeeRub?: number | null;
  operatorVpsPerDayRub?: number | null;
} | null | undefined): OperatorPriceSheet {
  return {
    connectFeeRub: cfg?.operatorConnectFeeRub || DEFAULT_CONNECT_FEE_RUB,
    aiApiRub: cfg?.operatorAiApiRub || DEFAULT_AI_API_RUB,
    aiApiUsd: cfg?.operatorAiApiUsd || DEFAULT_AI_API_USD,
    supportFeeRub: cfg?.operatorSupportFeeRub || DEFAULT_SUPPORT_FEE_RUB,
    vpsPerDayRub: cfg?.operatorVpsPerDayRub || DEFAULT_VPS_PER_DAY_RUB,
  };
}

export function pricesFromSub(sub: {
  connectFeeRub: number;
  aiApiRub: number;
  aiApiUsd: number;
  supportFeeRub: number;
  vpsPerDayRub: number;
}): OperatorPriceSheet {
  return {
    connectFeeRub: sub.connectFeeRub,
    aiApiRub: sub.aiApiRub,
    aiApiUsd: sub.aiApiUsd,
    supportFeeRub: sub.supportFeeRub,
    vpsPerDayRub: sub.vpsPerDayRub,
  };
}

export function buildBillingReport(input: BillingInput): BillingReport {
  const now = input.now ?? new Date();
  const mode = asBillingMode(input.billingMode);
  const connectFeeRub = input.connectFeeRub || DEFAULT_CONNECT_FEE_RUB;
  const vpsPerDayRub = input.vpsPerDayRub || DEFAULT_VPS_PER_DAY_RUB;
  const aiApiRub = input.aiApiRub || DEFAULT_AI_API_RUB;
  const aiApiUsd = input.aiApiUsd || DEFAULT_AI_API_USD;
  const supportFeeRub = input.supportFeeRub || DEFAULT_SUPPORT_FEE_RUB;
  const periodIndex = Math.max(1, input.periodIndex || 1);
  const firstPeriod = periodIndex <= 1;
  const connectFeeDue = input.connectFeePaid ? 0 : connectFeeRub;
  const supportDue = firstPeriod ? 0 : supportFeeRub;

  const unlimited = mode === "unlimited";
  const paused = mode === "paused";
  const start = input.periodStart || input.connectedAt;
  const end = input.expiresAt;

  let expired = false;
  let daysLeft: number | null = null;
  if (unlimited) {
    daysLeft = null;
  } else if (paused && input.pausedAt && end) {
    daysLeft = daysLeftCeil(input.pausedAt, end);
  } else if (end) {
    expired = end.getTime() < now.getTime();
    daysLeft = expired ? 0 : daysLeftCeil(now, end);
  }

  const meterEnd = paused && input.pausedAt
    ? input.pausedAt
    : expired && end
      ? end
      : now;
  let vpsDays = daysUsed(start, meterEnd);
  const vpsDaysAtEnd = unlimited || !end ? vpsDays : daysUsed(start, end);
  if (!unlimited) vpsDays = Math.min(vpsDays, vpsDaysAtEnd);

  const vpsCost = vpsDays * vpsPerDayRub;
  const vpsCostAtEnd = vpsDaysAtEnd * vpsPerDayRub;
  const fixed = connectFeeDue + supportDue + aiApiRub;
  const accruedNow = fixed + vpsCost;
  const accruedAtEnd = fixed + vpsCostAtEnd;
  const periodPaid = Boolean(input.periodPaid);
  const dueNow = periodPaid ? 0 : accruedNow;
  const dueAtEnd = periodPaid ? 0 : accruedAtEnd;
  const paidLabel: "оплачен" | "не оплачен" = periodPaid ? "оплачен" : "не оплачен";

  let label = paidLabel as string;
  if (unlimited) label = `${paidLabel} · без остановки`;
  else if (paused) label = `${paidLabel} · пауза`;
  else if (expired) label = `${paidLabel} · срок вышел`;
  else if (daysLeft != null) label = `${paidLabel} · ещё ${daysLeft} дн.`;

  return {
    connectedAt: input.connectedAt.toISOString(),
    periodStart: input.periodStart?.toISOString() || null,
    expiresAt: end?.toISOString() || null,
    daysLeft,
    expired,
    paused,
    unlimited,
    mode,
    periodIndex,
    firstPeriod,
    vpsPerDayRub,
    vpsDays,
    vpsCost,
    vpsDaysAtEnd,
    vpsCostAtEnd,
    aiApiRub,
    aiApiUsd,
    supportFeeRub,
    supportDue,
    connectFeeRub,
    connectFeeDue,
    accruedNow,
    accruedAtEnd,
    dueNow,
    dueAtEnd,
    periodPaid,
    periodPaidAt: input.periodPaidAt?.toISOString() || null,
    paidLabel,
    label,
  };
}

export function formatRub(n: number): string {
  return n.toLocaleString("ru-RU") + " ₽";
}

export function reportFromSub(
  sub: {
    createdAt: Date;
    periodStart: Date | null;
    quotaPeriodStart?: Date | null;
    expiresAt: Date | null;
    billingMode: string;
    pausedAt: Date | null;
    connectFeeRub: number;
    vpsPerDayRub: number;
    aiApiRub: number;
    aiApiUsd?: number;
    supportFeeRub?: number;
    periodIndex?: number;
    connectFeePaid: boolean;
    periodPaid?: boolean;
    periodPaidAt?: Date | null;
  },
  connectedAt?: Date,
): BillingReport {
  return buildBillingReport({
    connectedAt: connectedAt || sub.createdAt,
    periodStart: sub.periodStart || sub.quotaPeriodStart || sub.createdAt,
    expiresAt: sub.expiresAt,
    billingMode: sub.billingMode,
    pausedAt: sub.pausedAt,
    connectFeeRub: sub.connectFeeRub,
    vpsPerDayRub: sub.vpsPerDayRub,
    aiApiRub: sub.aiApiRub,
    aiApiUsd: sub.aiApiUsd,
    supportFeeRub: sub.supportFeeRub,
    periodIndex: sub.periodIndex,
    connectFeePaid: sub.connectFeePaid,
    periodPaid: sub.periodPaid ?? false,
    periodPaidAt: sub.periodPaidAt ?? null,
  });
}
