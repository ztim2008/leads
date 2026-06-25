import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    if (body.event !== "payment.succeeded") return NextResponse.json({ ok: true });
    const payment = body.object;
    const metadata = payment.metadata || {};
    const amount = parseFloat(payment.amount?.value || "0");
    const email = metadata.email || "";
    const plan = metadata.plan || "pro";
    const service = metadata.service || "leads";
    const workspaceId = metadata.workspaceId;

    // === Сохраняем платёж ===
    try {
      await db.paymentLog.create({
        data: {
          userId: (await db.workspace.findUnique({ where: { id: workspaceId } }))?.userId || "unknown",
          workspaceId: workspaceId || "unknown",
          amount,
          currency: payment.amount?.currency || "RUB",
          plan,
          paymentId: payment.id,
          status: "succeeded",
          email,
        },
      });
    } catch (e) {
      console.error("[billing] paymentLog error:", e);
    }

    // === Обновляем/создаём подписку ===
    if (workspaceId) {
      const existing = await db.subscription.findUnique({ where: { workspaceId } });
      if (existing) {
        await db.subscription.update({
          where: { workspaceId },
          data: {
            plan,
            status: "active",
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            leadsPerDay: 999999,
            sourcesLimit: 999,
            aiAnalysis: true,
            aiResponses: true,
          },
        });
      } else {
        const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
        if (ws) {
          await db.subscription.create({
            data: {
              workspaceId,
              userId: ws.userId,
              plan,
              status: "active",
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              leadsPerDay: 999999,
              sourcesLimit: 999,
              aiAnalysis: true,
              aiResponses: true,
            },
          });
        }
      }
    }

    // === Telegram админу ===
    const botToken = process.env.TELEGRAM_BOT_TOKEN || "8924588782:AAGalvqpkASuXy2ZgmtlApk5W1HRxHKnmrg";
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || "778784292";
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: `💳 *Платёж получен!*\n\n👤 ${email}\n💰 ${amount} ₽\n📅 Pro до ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("ru-RU")}\n🆔 ${payment.id.slice(0, 12)}...`,
          parse_mode: "Markdown",
        }),
        signal: AbortSignal.timeout(8000),
      });
      console.log("[billing] 📨 Telegram admin: " + amount + " RUB от " + email);
    } catch {}

    // === Telegram партнёру ===
    if (workspaceId) {
      const ws = await db.workspace.findUnique({ where: { id: workspaceId }, include: { settings: true, user: true } });
      if (ws?.settings?.telegramChatId && ws?.settings?.telegramToken) {
        try {
          await fetch(`https://api.telegram.org/bot${ws.settings.telegramToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: ws.settings.telegramChatId,
              text: `✅ *Оплата прошла!*\n\n💰 ${amount} ₽\n📅 Pro активен до ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("ru-RU")}\n\nСпасибо! 🚀`,
              parse_mode: "Markdown",
            }),
            signal: AbortSignal.timeout(8000),
          });
        } catch {}
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[billing] webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
