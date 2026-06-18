import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function GET() {
  // Читаем статус из файла (пишется PM2-воркером)
  try {
    const statusPath = join(process.cwd(), ".worker-status.json");
    if (existsSync(statusPath)) {
      const raw = readFileSync(statusPath, "utf-8");
      return NextResponse.json(JSON.parse(raw));
    }
  } catch {}

  // Фолбэк
  return NextResponse.json({
    running: false,
    statusReason: "Воркер не запущен",
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  // Управление через PM2: systemctl/bpm
  const { exec } = require("child_process");
  if (body.action === "start") {
    exec("pm2 start leads-worker", () => {});
    return NextResponse.json({ ok: true });
  }
  if (body.action === "stop") {
    exec("pm2 stop leads-worker", () => {});
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "action must be 'start' or 'stop'" }, { status: 400 });
}
