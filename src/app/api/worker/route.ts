// API управления воркером
import { NextResponse } from "next/server";
import { getWorkerStatus, startScheduler, stopScheduler } from "@/lib/queue/worker";

export async function GET() {
  return NextResponse.json(getWorkerStatus());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  if (body.action === "start") {
    startScheduler();
    return NextResponse.json({ ok: true, running: true });
  }

  if (body.action === "stop") {
    stopScheduler();
    return NextResponse.json({ ok: true, running: false });
  }

  return NextResponse.json({ error: "action must be 'start' or 'stop'" }, { status: 400 });
}
