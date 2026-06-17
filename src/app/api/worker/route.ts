import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { getWorkerStatus, startScheduler, stopScheduler } from "@/lib/queue/worker";

export async function GET() {
  return NextResponse.json(getWorkerStatus());
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Только admin может управлять воркером
  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.action === "start") { startScheduler(); return NextResponse.json({ ok: true, running: true }); }
  if (body.action === "stop") { stopScheduler(); return NextResponse.json({ ok: true, running: false }); }
  return NextResponse.json({ error: "action must be 'start' or 'stop'" }, { status: 400 });
}
