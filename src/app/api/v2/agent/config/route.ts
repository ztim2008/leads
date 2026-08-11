import { db } from "@/lib/db";
import { agentUnauthorized, verifyAgentSecret } from "@/lib/agent/auth";
import { getQuotaStatus } from "@/lib/billing/quota";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const sourceId = req.nextUrl.searchParams.get("sourceId");

  if (!verifyAgentSecret(secret) || !sourceId) {
    return agentUnauthorized();
  }

  const source = await db.source.findUnique({
    where: { id: sourceId },
    include: { workspace: { include: { settings: true } } },
  });

  if (!source) {
    return NextResponse.json({ error: "source not found" }, { status: 404 });
  }

  const quota = await getQuotaStatus(source.workspaceId);
  const collectionPaused = !source.enabled || !quota.allowed;

  const cfg = (source.config as Record<string, unknown>) || {};
  const s = source.workspace.settings;

  return NextResponse.json({
    version: 2,
    sourceId: source.id,
    platform: source.platform,
    login: cfg.login,
    password: cfg.password,
    keywords: cfg.keywords || "",
    minusKeywords: cfg.minusKeywords || "",
    titleKeywords: cfg.titleKeywords || "",
    titleMinusKeywords: cfg.titleMinusKeywords || "",
    budgetMin: cfg.budgetMin ?? null,
    budgetMax: cfg.budgetMax ?? null,
    antiDetect: cfg.antiDetect || { mode: "light" },
    workHoursStart: cfg.workHoursStart || "08:00",
    workHoursEnd: cfg.workHoursEnd || "22:00",
    proxy: cfg.proxy || null,
    telegramChatId: s?.telegramChatId || null,
    telegramToken: s?.telegramToken || null,
    telegramAlerts: s?.telegramAlerts !== false,
    collectionPaused,
    quota: { used: quota.used, limit: quota.limit, reason: quota.reason },
    apiUrl: process.env.NEXT_PUBLIC_URL || "https://leads.konversus.ru",
  });
}
