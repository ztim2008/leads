import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    // Проверяем что это уведомление о успешном платеже
    if (body.event !== "payment.succeeded") {
      return NextResponse.json({ ok: true }); // игнорируем другие события
    }

    const payment = body.object;
    const metadata = payment.metadata;
    const workspaceId = metadata?.workspaceId;
    const plan = metadata?.plan || "pro";

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspaceId in metadata" }, { status: 400 });
    }

    // Активируем или создаём подписку
    const existing = await db.subscription.findUnique({ where: { workspaceId } });

    if (existing) {
      await db.subscription.update({
        where: { workspaceId },
        data: {
          plan,
          status: "active",
          leadsPerDay: 999999,
          sourcesLimit: 999,
          aiAnalysis: true,
          aiResponses: true,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 дней
        },
      });
    } else {
      // Найти пользователя для этого workspace
      const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
      if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

      await db.subscription.create({
        data: {
          workspaceId,
          userId: ws.userId,
          plan,
          status: "active",
          leadsPerDay: 999999,
          sourcesLimit: 999,
          aiAnalysis: true,
          aiResponses: true,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }

    console.log(`[billing] ✅ Pro активирован для workspace ${workspaceId}`);

    // Логируем
    await db.activityLog.create({
      data: {
        workspaceId,
        type: "payment_received",
        description: `Оплата Pro: ${payment.amount?.value} ${payment.amount?.currency} (платёж ${payment.id})`,
        metadata: { paymentId: payment.id, amount: payment.amount },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[billing] webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
