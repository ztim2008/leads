import { hash } from "bcryptjs";
import { db } from "../../src/lib/db";
import { createPartnerSubscription } from "../../src/lib/billing/quota";
import type { Prisma } from "@prisma/client";
import type { PartnerInput } from "./types";
import { buildAccessCard, setupCommandFor, type PartnerAccessCard } from "../../src/lib/admin/access-card";

export interface OnboardResult {
  ok: boolean;
  email?: string;
  workspaceId?: string;
  sourceId?: string;
  setupCommand?: string;
  partnerPassword?: string;
  accessCard?: PartnerAccessCard;
  error?: string;
}

export async function onboardPartner(input: PartnerInput): Promise<OnboardResult> {
  const exists = await db.user.findUnique({ where: { email: input.email } });
  if (exists) {
    return { ok: false, error: `Email уже существует: ${input.email}` };
  }

  const passwordHash = await hash(input.password, 12);
  const name = input.name || input.email.split("@")[0];

  const partner = await db.user.create({
    data: { email: input.email, passwordHash, firstName: name, role: "user" },
  });

  const ws = await db.workspace.create({
    data: { userId: partner.id, name, slug: `ws-${partner.id.slice(0, 8)}` },
  });

  await db.settings.create({
    data: {
      workspaceId: ws.id,
      keywords: input.keywords || "",
      minusKeywords: input.minusKeywords || "",
      budgetMin: input.budgetMin ?? 3000,
      budgetMax: input.budgetMax ?? 500000,
      telegramChatId: input.telegramChatId || null,
      telegramToken: input.telegramToken || null,
    },
  });

  await createPartnerSubscription(ws.id, partner.id, input.leadsPerMonth);

  const cfg: Record<string, unknown> = {
    mode: "watch",
    login: input.profiLogin,
    password: input.profiPassword,
    _hubPassword: input.password,
    keywords: input.keywords || "",
    minusKeywords: input.minusKeywords || "",
    budgetMin: input.budgetMin ?? 3000,
    budgetMax: input.budgetMax ?? 500000,
    antiDetect: { mode: "light" },
    workHoursStart: "08:00",
    workHoursEnd: "22:00",
  };

  if (input.vpsIp) {
    cfg._vpsIp = input.vpsIp;
    cfg._onboardingVpsReady = true;
  }

  const source = await db.source.create({
    data: {
      workspaceId: ws.id,
      platform: "profi",
      name: "Profi.ru",
      enabled: true,
      color: "#22c55e",
      status: "pending",
      config: cfg as Prisma.InputJsonValue,
    },
  });

  const setupCommand = setupCommandFor(source.id) || "";

  return {
    ok: true,
    email: input.email,
    workspaceId: ws.id,
    sourceId: source.id,
    setupCommand,
    partnerPassword: input.password,
    accessCard: buildAccessCard({
      partnerId: partner.id,
      email: input.email,
      name,
      hubPassword: input.password,
      sourceId: source.id,
      sourceConfig: cfg,
      telegramChatId: input.telegramChatId || null,
      leadsPerMonth: input.leadsPerMonth,
    }),
  };
}
