import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    if (body.event !== "payment.succeeded") {
      return NextResponse.json({ ok: true });
    }

    const payment = body.object;
    const metadata = payment.metadata;
    const service = metadata?.service || "leads";
    
    // Логируем все платежи в единую таблицу
    await db.activityLog.create({
      data: {
        workspaceId: "system",
        type: "payment_received",
        description: `Платёж ${payment.amount?.value} ${payment.amount?.currency} · ${service} · ${metadata?.plan || "pro"} · ID: ${payment.id}`,
        metadata: { paymentId: payment.id, amount: payment.amount, service, plan: metadata?.plan },
      },
    });

    // Сохраняем в общий лог платежей (для единого дашборда)
    try {
      await db.$executeRaw`
        INSERT INTO chat_ai.public.billing_payments (id, service, plan, amount, email, payment_id, created_at)
        VALUES (${crypto.randomUUID()}, ${service}, ${metadata?.plan || "pro"}, ${parseFloat(payment.amount?.value || "0")}, ${metadata?.email || ""}, ${payment.id}, NOW())
      `;
    } catch {}

    // Для leads.konversus.ru — своя логика
    const workspaceId = metadata?.workspaceId;
    if (workspaceId) {
      const existing = await db.subscription.findUnique({ where: { workspaceId } });
      if (existing) {
        await db.subscription.update({
          where: { workspaceId },
          data: { plan: metadata?.plan || "pro", status: "active", expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        });
      } else {
        const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
        if (ws) {
          await db.subscription.create({
            data: { workspaceId, userId: ws.userId, plan: metadata?.plan || "pro", status: "active", expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
          });
        }
      }
    }

    // Для других сервисов — сохраняем metadata для опроса
    if (service !== "leads" && metadata) {
      // Сервис сам опрашивает статус платежа через API
      console.log(`[billing] ${service}: платёж получен, ждём опроса сервисом`);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[billing] webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
