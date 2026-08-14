import { db } from "@/lib/db";
import { resolveServiceBotToken } from "@/lib/telegram/bot-token";
import {
  sendLeadNotification,
  type LeadNotification,
} from "@/lib/telegram/notifications";

export const TELEGRAM_DELIVERY_ACTIVITY = "telegram_lead_delivered";
export const TELEGRAM_ATTEMPT_ACTIVITY = "telegram_lead_attempted";

const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || "778784292";

export function mskDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function mskDayStart(now = new Date()): Date {
  return new Date(`${mskDateKey(now)}T00:00:00+03:00`);
}

type TrackedNotification = {
  workspaceId: string;
  sourceId: string;
  leadId: string;
  chatId: string;
  botToken?: string;
  lead: LeadNotification;
};

async function notifyFirstDelivery(workspaceId: string, dateKey: string): Promise<void> {
  const markerId = `tg-first:${workspaceId}:${dateKey}`;
  try {
    await db.activityLog.create({
      data: {
        id: markerId,
        workspaceId,
        type: "telegram_first_delivery_day",
        description: "Первая успешная доставка заявки в Telegram за день",
        metadata: { date: dateKey },
      },
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code !== "P2002") {
      console.error("[telegram-delivery] first marker:", error);
    }
    return;
  }

  try {
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, user: { select: { email: true, firstName: true } } },
    });
    const name =
      workspace?.user?.firstName ||
      workspace?.name ||
      workspace?.user?.email ||
      workspaceId.slice(0, 8);
    const { token } = await resolveServiceBotToken();
    if (!token || !ADMIN_CHAT_ID) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: `🟢 ${name}: первая заявка сегодня доставлена в Telegram`,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.error("[telegram-delivery] admin first delivery:", error);
  }
}

export async function sendTrackedLeadNotification(
  input: TrackedNotification,
): Promise<boolean> {
  try {
    await db.activityLog.create({
      data: {
        workspaceId: input.workspaceId,
        type: TELEGRAM_ATTEMPT_ACTIVITY,
        description: "Попытка доставки заявки партнёру в Telegram",
        metadata: {
          date: mskDateKey(),
          leadId: input.leadId,
          sourceId: input.sourceId,
        },
      },
    });
  } catch (error) {
    console.error("[telegram-delivery] attempt:", error);
  }

  const delivered = await sendLeadNotification(
    input.chatId,
    input.lead,
    input.botToken,
  );
  if (!delivered) return false;

  const dateKey = mskDateKey();
  try {
    await db.activityLog.create({
      data: {
        workspaceId: input.workspaceId,
        type: TELEGRAM_DELIVERY_ACTIVITY,
        description: "Заявка доставлена партнёру в Telegram",
        metadata: {
          date: dateKey,
          leadId: input.leadId,
          sourceId: input.sourceId,
        },
      },
    });
    await notifyFirstDelivery(input.workspaceId, dateKey);
  } catch (error) {
    console.error("[telegram-delivery] record:", error);
  }
  return true;
}
