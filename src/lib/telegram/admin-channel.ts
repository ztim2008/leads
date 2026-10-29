import { db } from "@/lib/db";

/** Бот и чат из настроек кабинета админа; env — запасной вариант (TELEGRAM_BOT_TOKEN админ мог не запускать). */
export async function resolveAdminChannel(): Promise<{ token: string; chat: string }> {
  const admin = await db.settings
    .findFirst({
      where: {
        telegramToken: { not: null },
        telegramChatId: { not: null },
        workspace: { user: { role: "admin" } },
      },
      select: { telegramToken: true, telegramChatId: true },
    })
    .catch(() => null);
  return {
    token: (admin?.telegramToken || process.env.TELEGRAM_BOT_TOKEN || "").trim(),
    chat: (admin?.telegramChatId || process.env.TELEGRAM_ADMIN_CHAT_ID || "778784292").trim(),
  };
}
