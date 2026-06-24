import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { serviceToken, service, plan, amount, returnUrl, metadata } = await req.json();
  
  const VALID_TOKENS: Record<string, string> = {
    "chat.konversus.ru": process.env.SERVICE_CHAT_TOKEN || "chat-service-token-2026",
  };
  
  if (!service || !VALID_TOKENS[service] || VALID_TOKENS[service] !== serviceToken) {
    return NextResponse.json({ error: "Invalid service token" }, { status: 403 });
  }

  const shopId = process.env.YOOKASSA_SHOP_ID || "";
  const secretKey = process.env.YOOKASSA_SECRET_KEY || "";
  if (!shopId || !secretKey) {
    return NextResponse.json({ error: "YooKassa not configured" }, { status: 500 });
  }

  try {
    const idempotenceKey = `${service}-${Date.now()}`;
    const body: any = {
      amount: { value: String(amount), currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: returnUrl },
      description: `Konversus ${service} — тариф ${plan.toUpperCase()}`,
      metadata: { ...(metadata || {}), service, plan },
    };

    const res = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64"),
        "Idempotence-Key": idempotenceKey,
      },
      body: JSON.stringify(body),
    });

    const payment = await res.json() as any;
    if (payment.id) {
      return NextResponse.json({ ok: true, paymentId: payment.id, confirmationUrl: payment.confirmation?.confirmation_url });
    }
    return NextResponse.json({ error: payment.description || "Payment creation failed" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
