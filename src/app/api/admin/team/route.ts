import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { requireAdminUser } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { ROLE_LABELS, ROLES } from "@/lib/auth/roles";

function genPassword(len = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** Список команды: admin + sales (не партнёры). */
export async function GET() {
  const gate = await requireAdminUser();
  if (gate.error) return gate.error;

  const users = await db.user.findMany({
    where: { role: { in: [ROLES.ADMIN, ROLES.SALES] } },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      loginEnabled: true,
      createdAt: true,
      _count: { select: { crmClientsOwned: true } },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      roleLabel: ROLE_LABELS[u.role] || u.role,
      ownedClients: u._count.crmClientsOwned,
    })),
  });
}

/** Создать напарника (sales) или сбросить пароль / отключить. */
export async function POST(req: NextRequest) {
  const gate = await requireAdminUser();
  if (gate.error) return gate.error;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "create");

  if (action === "create") {
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const password = String(body.password || "").trim() || genPassword();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Нужен email" }, { status: 400 });
    }
    const exists = await db.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "Такой email уже есть" }, { status: 409 });
    }
    const passwordHash = await hash(password, 12);
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        firstName: name || email.split("@")[0],
        role: ROLES.SALES,
        loginEnabled: true,
      },
    });
    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        role: user.role,
        roleLabel: ROLE_LABELS.sales,
      },
      password,
      loginUrl: "https://leads.konversus.ru/auth",
      homePath: "/dashboard/crm",
    });
  }

  if (action === "reset_password") {
    const userId = String(body.userId || "");
    const password = String(body.password || "").trim() || genPassword();
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== ROLES.SALES) {
      return NextResponse.json({ error: "Только для роли sales" }, { status: 400 });
    }
    await db.user.update({
      where: { id: userId },
      data: { passwordHash: await hash(password, 12), loginEnabled: true },
    });
    return NextResponse.json({
      ok: true,
      email: user.email,
      password,
      loginUrl: "https://leads.konversus.ru/auth",
    });
  }

  if (action === "set_login") {
    const userId = String(body.userId || "");
    const enabled = Boolean(body.loginEnabled);
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || user.role === ROLES.ADMIN) {
      return NextResponse.json({ error: "Нельзя отключить админа так" }, { status: 400 });
    }
    if (user.role !== ROLES.SALES) {
      return NextResponse.json({ error: "Только sales" }, { status: 400 });
    }
    await db.user.update({ where: { id: userId }, data: { loginEnabled: enabled } });
    return NextResponse.json({ ok: true, loginEnabled: enabled });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
