import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plan } = await req.json();
  if (!plan) return NextResponse.json({ error: "plan required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const ws = await db.workspace.findFirst({ where: { userId: user.id } });
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const shopId = process.env.YOOKASSA_SHOP_ID || "";
  const secretKey = process.env.YOOKASSA_SECRET_KEY || "";

  if (!shopId || !secretKey) {
    return NextResponse.json({ error: "YooKassa not configured" }, { status: 500 });
  }

  try {
    const idempotenceKey = `${ws.id}-${Date.now()}`;
    
    const body: any = {
      amount: { value: plan === "pro" ? "999.00" : "999.00", currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: `https://leads.konversus.ru/dashboard/billing?paid=1` },
      description: `Konversus Leads AI — тариф ${plan.toUpperCase()} на 1 месяц`,
      metadata: { workspaceId: ws.id, plan, email: user.email },
    };

    const res = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64"),
        "Idempotence-Key": idempotenceKey,
      },
      body: JSON.stringify(body),
    });

    const payment = await res.json();

    if (payment.id) {
      return NextResponse.json({
        ok: true,
        paymentId: payment.id,
        confirmationUrl: payment.confirmation?.confirmation_url,
      });
    }

    return NextResponse.json({ error: payment.description || "Payment creation failed" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
