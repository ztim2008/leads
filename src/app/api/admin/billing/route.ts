import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";

export async function GET() {
  const s = await auth();
  if (!s?.user) return NextResponse.json({ error: "Unauth" }, { status: 401 });
  const u = await db.user.findUnique({ where: { email: (s.user as any).email } });
  if (!u || u.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const subs = await db.subscription.findMany({
    include: { workspace: { include: { user: { select: { email: true } } } } }
  });

  const subList = [];
  for (const sub of subs) {
    let cnt = 0;
    try {
      const wsId = sub.workspaceId || "";
      cnt = await (db as any).paymentLog.count({ where: { workspaceId: wsId } });
    } catch { cnt = 0; }
    subList.push({
      id: sub.id, workspaceId: sub.workspaceId, email: sub.workspace?.user?.email,
      plan: sub.plan, status: sub.status, expiresAt: sub.expiresAt?.toISOString() || null,
      paymentCount: cnt,
    });
  }

  const payments = await db.paymentLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const payList = payments.map((p: any) => ({
    id: p.id, email: p.email, amount: p.amount?.toString() || "0",
    plan: p.plan, paymentId: p.paymentId, createdAt: p.createdAt.toISOString(),
  }));

  let monthTotal = 0, todayTotal = 0, allTotal = 0;
  try {
    const now = new Date();
    const ms = new Date(now.getFullYear(), now.getMonth(), 1);
    const ts = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const all = await (db as any).paymentLog.findMany();
    for (const p of all) {
      const amt = parseFloat(p.amount?.toString() || "0");
      allTotal += amt;
      if (new Date(p.createdAt) >= ms) monthTotal += amt;
      if (new Date(p.createdAt) >= ts) todayTotal += amt;
    }
  } catch {}

  return NextResponse.json({
    subscriptions: subList, payments: payList,
    revenue: { today: todayTotal, month: monthTotal, total: allTotal },
  });
}

export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user) return NextResponse.json({ error: "Unauth" }, { status: 401 });
  const u = await db.user.findUnique({ where: { email: (s.user as any).email } });
  if (!u || u.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { action, workspaceId } = await req.json();
  if (action === "extend") {
    await db.subscription.update({ where: { workspaceId }, data: { status: "active", plan: "pro", expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
  } else if (action === "cancel") {
    await db.subscription.update({ where: { workspaceId }, data: { status: "expired" } });
  }
  return NextResponse.json({ ok: true });
}
