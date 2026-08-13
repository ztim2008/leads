const API_URL = process.env.NEXT_PUBLIC_URL || "https://leads.konversus.ru";

export interface PartnerAccessCard {
  partnerId: string;
  email: string;
  name: string | null;
  hubPassword: string | null;
  profiLogin: string | null;
  profiPassword: string | null;
  vpsIp: string | null;
  sourceId: string | null;
  setupCommand: string | null;
  telegramChatId: string | null;
  leadsPerMonth: number | null;
  workHoursStart: string | null;
  workHoursEnd: string | null;
}

export function setupCommandFor(sourceId: string | null | undefined): string | null {
  if (!sourceId) return null;
  return `curl -fsSL ${API_URL}/agent/v2/install.sh | bash -s "${sourceId}"`;
}

export function buildAccessCard(input: {
  partnerId: string;
  email: string;
  name?: string | null;
  hubPassword?: string | null;
  sourceId?: string | null;
  sourceConfig?: Record<string, unknown> | null;
  telegramChatId?: string | null;
  leadsPerMonth?: number | null;
}): PartnerAccessCard {
  const cfg = input.sourceConfig || {};
  const sourceId = input.sourceId || null;
  return {
    partnerId: input.partnerId,
    email: input.email,
    name: input.name || null,
    hubPassword: input.hubPassword ?? (typeof cfg._hubPassword === "string" ? cfg._hubPassword : null),
    profiLogin: typeof cfg.login === "string" ? cfg.login : null,
    profiPassword: typeof cfg.password === "string" ? cfg.password : null,
    vpsIp: typeof cfg._vpsIp === "string" ? cfg._vpsIp : null,
    sourceId,
    setupCommand: setupCommandFor(sourceId),
    telegramChatId: input.telegramChatId || null,
    leadsPerMonth: input.leadsPerMonth ?? null,
    workHoursStart: typeof cfg.workHoursStart === "string" ? cfg.workHoursStart : "08:00",
    workHoursEnd: typeof cfg.workHoursEnd === "string" ? cfg.workHoursEnd : "22:00",
  };
}
