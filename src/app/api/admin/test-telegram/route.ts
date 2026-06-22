import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!admin || admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email } = await req.json();
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const ws = await db.workspace.findFirst({ where: { userId: user.id }, include: { settings: true } });
  if (!ws?.settings?.telegramChatId || !ws?.settings?.telegramToken) {
    return NextResponse.json({ ok: false, error: "Не настроен Telegram (нет Chat ID или Bot Token)" });
  }

  try {
    // getMe
    const meRes = await fetch(`https://api.telegram.org/bot${ws.settings.telegramToken}/getMe`, { signal: AbortSignal.timeout(8000) });
    const meData: any = await meRes.json();
    if (!meData.ok) {
      return NextResponse.json({ ok: false, error: `Бот не отвечает: ${meData.description || "неверный токен"}` });
    }

    // send test message
    const sendRes = await fetch(`https://api.telegram.org/bot${ws.settings.telegramToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ws.settings.telegramChatId,
        text: `🟢 *Leads AI — проверка связи*\\n\\nБот @${meData.result.username || "—"} работает корректно.\\nУведомления о заявках будут приходить сюда.`,
        parse_mode: "Markdown",
      }),
      signal: AbortSignal.timeout(8000),
    });
    const sendData: any = await sendRes.json();

    if (sendData.ok) {
      return NextResponse.json({ ok: true, botName: `@${meData.result.username || "бот"}`, chatId: ws.settings.telegramChatId });
    }

    const desc = sendData.description || "";
    if (desc.includes("chat not found")) {
      return NextResponse.json({ ok: false, error: "Чат не найден — пользователь не начал диалог с ботом. Попросите написать /start боту." });
    }
    if (desc.includes("bot was blocked")) {
      return NextResponse.json({ ok: false, error: "Бот заблокирован пользователем." });
    }
    return NextResponse.json({ ok: false, error: desc || "Не удалось отправить сообщение" });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Ошибка соединения" });
  }
}
