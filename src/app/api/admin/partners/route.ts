import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import { hash } from "bcryptjs";

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
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ partners: partners.map(p => {
    const ws = p.workspaces[0];
    return {
      id: p.id, email: p.email, name: p.firstName,
      role: p.role, createdAt: p.createdAt,
      workspace: ws ? {
        id: ws.id, name: ws.name,
        sources: ws.sources.map(s => ({
          id: s.id,
          platform: s.platform,
          enabled: s.enabled,
          lastCheckAt: s.lastCheckAt,
          status: s.status || "active",
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

// POST — создать партнёра
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { email, password, name, profiLogin, profiPassword, keywords, minusKeywords, budgetMin, budgetMax, telegramChatId, telegramToken } = body;

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
    data: { userId: partner.id, name: `${name || email.split("@")[0]}`, slug: `ws-${partner.id.slice(0, 8)}` },
  });

  // Создаём настройки
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

  // Подключаем Profi если есть логин
  if (profiLogin && profiPassword) {
    await db.source.create({
      data: {
        workspaceId: ws.id,
        platform: "profi", name: "Profi.ru",
        enabled: false, color: "#22c55e", status: "pending",
        config: { login: profiLogin, password: profiPassword },
      },
    });
  }

  return NextResponse.json({ ok: true, partnerId: partner.id, workspaceId: ws.id });
}
