import { db } from "@/lib/db";

export async function resolveRadarDelivery(profileChat: string | null): Promise<{ token: string; chat: string } | null> {
  const admin = await db.settings.findFirst({
    where: {
      telegramToken: { not: null },
      telegramChatId: { not: null },
      workspace: { user: { role: "admin" } },
    },
    select: { telegramToken: true, telegramChatId: true },
  });
  const token = (admin?.telegramToken || process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chat = (profileChat || admin?.telegramChatId || process.env.TELEGRAM_ADMIN_CHAT_ID || "").trim();
  if (!token || !chat) return null;
  return { token, chat };
}
