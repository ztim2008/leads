import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hash } from "bcryptjs";

export async function POST(req: Request) {
  const { email, password, name } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email и пароль обязательны" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Пароль должен быть не менее 6 символов" }, { status: 400 });
  }

  const exists = await db.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "Пользователь с таким email уже существует" }, { status: 409 });
  }

  const passwordHash = await hash(password, 12);
  const user = await db.user.create({
    data: { email, passwordHash, firstName: name || email.split("@")[0] },
  });

  const workspace = await db.workspace.create({
    data: { userId: user.id, name: "Моё пространство", slug: `ws-${user.id.slice(0, 8)}` },
  });
  await db.settings.create({ data: { workspaceId: workspace.id } });

  return NextResponse.json({ ok: true });
}
