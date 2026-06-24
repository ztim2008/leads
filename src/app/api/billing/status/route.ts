import { NextRequest, NextResponse } from "next/server";

// API для проверки статуса платежа другим сервисом
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const paymentId = url.searchParams.get("paymentId");
  if (!paymentId) return NextResponse.json({ error: "paymentId required" }, { status: 400 });

  const shopId = process.env.YOOKASSA_SHOP_ID || "";
  const secretKey = process.env.YOOKASSA_SECRET_KEY || "";

  try {
    const res = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      headers: { Authorization: "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64") },
    });
    const payment = await res.json();
    return NextResponse.json({ ok: true, status: payment.status, paid: payment.paid, metadata: payment.metadata });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
