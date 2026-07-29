// GET /api/agent/config?secret=xxx&sourceId=yyy
// Агент запрашивает свой конфиг: логин, пароль, ключевые слова, antiDetect

import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const AGENT_SECRET = process.env.AGENT_SECRET || "leads-agent-secret-2026";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const sourceId = req.nextUrl.searchParams.get("sourceId");

  if (secret !== AGENT_SECRET || !sourceId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const source = await db.source.findUnique({
    where: { id: sourceId },
    include: { workspace: { include: { settings: true } } },
  });

  if (!source || !source.enabled) {
    return NextResponse.json({ error: "source not found" }, { status: 404 });
  }

  const cfg = source.config as any || {};
  const s = source.workspace.settings;

  return NextResponse.json({
    sourceId: source.id,
    platform: source.platform,
    login: cfg.login,
    password: cfg.password,
    keywords: cfg.keywords || "",
    minusKeywords: cfg.minusKeywords || "",
    titleKeywords: cfg.titleKeywords || "",
    titleMinusKeywords: cfg.titleMinusKeywords || "",
    budgetMin: cfg.budgetMin || null,
    budgetMax: cfg.budgetMax || null,
    antiDetect: cfg.antiDetect || { mode: "light" },
    workHoursStart: cfg.workHoursStart || "08:00",
    workHoursEnd: cfg.workHoursEnd || "22:00",
    proxy: cfg.proxy || null,
    telegramChatId: s?.telegramChatId || null,
    telegramToken: s?.telegramToken || null,
    telegramAlerts: s?.telegramAlerts !== false,
    apiUrl: process.env.NEXT_PUBLIC_URL || "https://leads.konversus.ru",
  });
}
