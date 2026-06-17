import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Найти пользователя и workspace
  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const workspace = await db.workspace.findFirst({ where: { userId: user.id } });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const body = await req.json();
  const { workspaceId, ...fields } = body;

  // Проверить что workspaceId принадлежит текущему пользователю
  if (workspaceId && workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Forbidden: wrong workspace" }, { status: 403 });
  }

  await db.settings.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, ...fields },
    update: fields,
  });

  return NextResponse.json({ ok: true });
}
