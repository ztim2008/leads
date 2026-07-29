// POST /api/admin/partners — создать партнёра с полным конфигом
// Возвращает setup-команду для VPS

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import { hash } from "bcryptjs";

const AGENT_SECRET = process.env.AGENT_SECRET || "leads-agent-secret-2026";
const API_URL = process.env.NEXT_PUBLIC_URL || "https://leads.konversus.ru";

// GET — список партнёров
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const partners = await db.user.findMany({
    where: { role: { not: "admin" } },
    include: {
      workspaces: { include: { sources: true, settings: true, _count: { select: { leads: true } } } },
      subscription: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ partners: partners.map(p => {
    const ws = p.workspaces[0];
    return {
      id: p.id, email: p.email, name: p.firstName,
      role: p.role, createdAt: p.createdAt,
      subscription: p.subscription ? { plan: p.subscription.plan, status: p.subscription.status } : null,
      workspace: ws ? {
        id: ws.id, name: ws.name,
        sources: ws.sources.map(s => ({
          id: s.id, platform: s.platform, enabled: s.enabled,
          lastCheckAt: s.lastCheckAt, status: s.status || "active",
          lastError: s.lastError || null,
        })),
        settings: ws.settings ? {
          keywords: ws.settings.keywords,
          telegramChatId: ws.settings.telegramChatId,
          telegramToken: ws.settings.telegramToken,
        } : null,
        leadsCount: ws._count.leads,
      } : null,
    };
  }) });
}

// POST — создать партнёра + source + вернуть команду для VPS
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  let sourceId: string | null = null;

  // Подключаем Profi если есть логин
  if (profiLogin && profiPassword) {
    const antiDetect = antiDetectMode === "stealth"
      ? { mode: "stealth", delayMultiplier: 1.5, disableDeepScan: false, extraSkipPercent: 0 }
      : antiDetectMode === "balanced"
      ? { mode: "balanced", delayMultiplier: 1.0, disableDeepScan: false, extraSkipPercent: 0 }
      : { mode: "light" };

    const source = await db.source.create({
      data: {
        workspaceId: ws.id,
        platform: "profi", name: "Profi.ru",
        enabled: true, color: "#22c55e", status: "pending",
        config: {
          mode: "watch",
          login: profiLogin,
          password: profiPassword,
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
        },
      },
    });
    sourceId = source.id;
  }

  // Формируем команду для VPS
  let setupCommand = "";
  if (sourceId) {
    setupCommand = `curl -fsSL ${API_URL}/agent/setup.sh | bash -s "${sourceId}"`;
  }

  return NextResponse.json({
    ok: true,
    partnerId: partner.id,
    workspaceId: ws.id,
    sourceId,
    setupCommand,
    setupInstructions: sourceId ? {
      title: "🚀 Команда для VPS партнёра",
      command: setupCommand,
      steps: [
        "1. Подключись к VPS: ssh root@IP_ПАРТНЁРА",
        "2. Выполни команду ниже",
        "3. Проверь: pm2 status (должен быть leads-agent online)",
      ],
    } : null,
  });
}
