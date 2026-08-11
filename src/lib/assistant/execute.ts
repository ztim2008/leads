import { db } from "@/lib/db";
import { hash } from "bcryptjs";
import { renewPartnerMonth, setCollectionEnabled, createPartnerSubscription } from "@/lib/billing/quota";
import type { AssistantActionType, PendingAction } from "./types";

const API_URL = process.env.NEXT_PUBLIC_URL || "https://leads.konversus.ru";

async function findPartner(email: string) {
  const user = await db.user.findUnique({
    where: { email },
    include: {
      workspaces: {
        include: {
          sources: true,
          settings: true,
          _count: { select: { leads: true } },
        },
      },
      subscription: true,
    },
  });
  if (!user || user.role === "admin") return null;
  const ws = user.workspaces[0];
  return { user, ws };
}

export async function executeAction(
  type: AssistantActionType,
  params: Record<string, string | number | boolean>,
): Promise<{ ok: boolean; message: string }> {
  switch (type) {
    case "list_partners":
      return listPartners();
    case "partner_status":
      return partnerStatus(String(params.email || ""));
    case "renew_month":
      return renewMonth(String(params.email || ""));
    case "toggle_collection":
      return toggleCollection(String(params.email || ""), Boolean(params.enabled));
    case "test_telegram":
      return testTelegram(String(params.email || ""));
    case "get_install_command":
      return installCommand(String(params.email || ""));
    case "save_vps_ip":
      return saveVpsIp(String(params.email || ""), String(params.vpsIp || ""));
    case "create_partner":
      return createPartner(params);
    default:
      return { ok: false, message: "Неизвестное действие" };
  }
}

async function listPartners(): Promise<{ ok: boolean; message: string }> {
  const partners = await db.user.findMany({
    where: { role: { not: "admin" } },
    include: { subscription: true, workspaces: { include: { _count: { select: { leads: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  if (partners.length === 0) return { ok: true, message: "Партнёров нет. Создайте через «+ Подключить»." };

  const lines = partners.map((p) => {
    const ws = p.workspaces[0];
    const sub = p.subscription;
    const used = sub?.leadsUsedMonth ?? 0;
    const limit = sub?.leadsPerMonth ?? 0;
    const on = sub?.collectionEnabled && (sub?.expiresAt ? sub.expiresAt.getTime() > Date.now() : true);
    return `• ${p.email} — ${used}/${limit} заявок, сбор ${on ? "вкл" : "стоп"}, лидов: ${ws?._count.leads ?? 0}`;
  });

  return { ok: true, message: `Партнёры (${partners.length}):\n${lines.join("\n")}` };
}

async function partnerStatus(email: string): Promise<{ ok: boolean; message: string }> {
  const p = await findPartner(email);
  if (!p?.ws) return { ok: false, message: `Партнёр ${email} не найден` };

  const source = p.ws.sources[0];
  const cfg = (source?.config as Record<string, unknown>) || {};
  const sub = p.user.subscription;
  const hb = cfg._lastHeartbeat as string | undefined;
  const online = hb ? Date.now() - new Date(hb).getTime() < 15 * 60 * 1000 : false;

  const lines = [
    `Партнёр: ${email}`,
    `Заявок в базе: ${p.ws._count.leads}`,
    `Лимит: ${sub?.leadsUsedMonth ?? 0}/${sub?.leadsPerMonth ?? 0}`,
    `Срок до: ${sub?.expiresAt ? sub.expiresAt.toLocaleDateString("ru") : "—"}`,
    `Сбор: ${sub?.collectionEnabled ? "вкл" : "стоп"}`,
    `Агент: ${online ? "online" : "offline"}`,
    `VPS IP: ${(cfg._vpsIp as string) || "не указан"}`,
    `Telegram: ${p.ws.settings?.telegramChatId ? "настроен" : "нет"}`,
  ];

  if (source?.id) {
    lines.push(`Install: curl -fsSL ${API_URL}/agent/v2/install.sh | bash -s "${source.id}"`);
  }

  return { ok: true, message: lines.join("\n") };
}

async function renewMonth(email: string): Promise<{ ok: boolean; message: string }> {
  const p = await findPartner(email);
  if (!p?.ws) return { ok: false, message: `Партнёр ${email} не найден` };
  const sub = await renewPartnerMonth(p.ws.id);
  return {
    ok: true,
    message: `✅ ${email}: месяц продлён до ${sub.expiresAt?.toLocaleDateString("ru")}, счётчик сброшен, сбор включён.`,
  };
}

async function toggleCollection(email: string, enabled: boolean): Promise<{ ok: boolean; message: string }> {
  const p = await findPartner(email);
  if (!p?.ws) return { ok: false, message: `Партнёр ${email} не найден` };
  await setCollectionEnabled(p.ws.id, enabled);
  return {
    ok: true,
    message: enabled ? `✅ Сбор включён для ${email}` : `⏸ Сбор остановлен для ${email}`,
  };
}

async function testTelegram(email: string): Promise<{ ok: boolean; message: string }> {
  const p = await findPartner(email);
  if (!p?.ws?.settings?.telegramChatId || !p.ws.settings.telegramToken) {
    return { ok: false, message: `Telegram не настроен для ${email}` };
  }

  try {
    const token = p.ws.settings.telegramToken;
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(8000) });
    const meData = await meRes.json();
    if (!meData.ok) return { ok: false, message: `Бот не отвечает: ${meData.description || "ошибка"}` };

    const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: p.ws.settings.telegramChatId,
        text: "🟢 Leads AI — тест от помощника оператора",
      }),
      signal: AbortSignal.timeout(8000),
    });
    const sendData = await sendRes.json();
    if (!sendData.ok) return { ok: false, message: sendData.description || "Не отправлено" };

    return { ok: true, message: `✅ Telegram OK для ${email} (@${meData.result?.username || "бот"})` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Ошибка Telegram" };
  }
}

async function installCommand(email: string): Promise<{ ok: boolean; message: string }> {
  const p = await findPartner(email);
  if (!p?.ws) return { ok: false, message: `Партнёр ${email} не найден` };
  const source = p.ws.sources[0];
  if (!source) return { ok: false, message: "Profi source не создан" };
  const cmd = `curl -fsSL ${API_URL}/agent/v2/install.sh | bash -s "${source.id}"`;
  return { ok: true, message: `Команда для VPS (${email}):\n\n${cmd}` };
}

async function saveVpsIp(email: string, vpsIp: string): Promise<{ ok: boolean; message: string }> {
  if (!vpsIp) return { ok: false, message: "IP не распознан. Укажите IP в сообщении." };
  const p = await findPartner(email);
  if (!p?.ws) return { ok: false, message: `Партнёр ${email} не найден` };
  const source = p.ws.sources[0];
  if (!source) return { ok: false, message: "Нет Profi source — создайте партнёра с Profi логином" };

  const cfg = (source.config as Record<string, unknown>) || {};
  await db.source.update({
    where: { id: source.id },
    data: {
      config: { ...cfg, _vpsIp: vpsIp, _onboardingVpsReady: true },
    },
  });

  const cmd = `curl -fsSL ${API_URL}/agent/v2/install.sh | bash -s "${source.id}"`;
  return {
    ok: true,
    message: `✅ IP ${vpsIp} сохранён для ${email}.\n\nSSH: ssh root@${vpsIp}\nЗатем:\n${cmd}\n\n(пароль SSH не сохраняется в системе)`,
  };
}

async function createPartner(params: Record<string, string | number | boolean>): Promise<{ ok: boolean; message: string }> {
  const email = String(params.email || "");
  const password = String(params.password || "");
  const profiLogin = String(params.profiLogin || "");
  const profiPassword = String(params.profiPassword || "");
  const leadsPerMonth = parseInt(String(params.leadsPerMonth)) || 500;

  if (!email || !password || !profiLogin || !profiPassword) {
    return { ok: false, message: "Неполные данные для создания" };
  }

  const exists = await db.user.findUnique({ where: { email } });
  if (exists) return { ok: false, message: `Email ${email} уже существует` };

  const passwordHash = await hash(password, 12);
  const name = String(params.name || email.split("@")[0]);
  const partner = await db.user.create({
    data: { email, passwordHash, firstName: name, role: "user" },
  });

  const ws = await db.workspace.create({
    data: { userId: partner.id, name, slug: `ws-${partner.id.slice(0, 8)}` },
  });

  await db.settings.create({
    data: {
      workspaceId: ws.id,
      keywords: String(params.keywords || ""),
      minusKeywords: String(params.minusKeywords || ""),
      budgetMin: parseInt(String(params.budgetMin)) || 3000,
      budgetMax: parseInt(String(params.budgetMax)) || 500000,
      telegramChatId: String(params.telegramChatId || "") || null,
      telegramToken: String(params.telegramToken || "") || null,
    },
  });

  await createPartnerSubscription(ws.id, partner.id, leadsPerMonth);

  const source = await db.source.create({
    data: {
      workspaceId: ws.id,
      platform: "profi",
      name: "Profi.ru",
      enabled: true,
      color: "#22c55e",
      status: "pending",
      config: {
        mode: "watch",
        login: profiLogin,
        password: profiPassword,
        keywords: String(params.keywords || ""),
        minusKeywords: String(params.minusKeywords || ""),
        budgetMin: 3000,
        budgetMax: 500000,
        antiDetect: { mode: "light" },
        workHoursStart: "08:00",
        workHoursEnd: "22:00",
      },
    },
  });

  const cmd = `curl -fsSL ${API_URL}/agent/v2/install.sh | bash -s "${source.id}"`;
  return {
    ok: true,
    message: `✅ Партнёр создан: ${email}\nПароль входа: ${password}\nЛимит: ${leadsPerMonth}/мес\n\nVPS:\n${cmd}`,
  };
}

export function buildPendingAction(
  type: AssistantActionType,
  params: Record<string, string | number | boolean>,
): PendingAction | null {
  const id = `act-${Date.now()}`;

  switch (type) {
    case "renew_month":
      return {
        id,
        type,
        label: `Продлить месяц для ${params.email}`,
        params,
      };
    case "toggle_collection":
      return {
        id,
        type,
        label: `${params.enabled ? "Включить" : "Остановить"} сбор для ${params.email}`,
        params,
      };
    case "test_telegram":
      return {
        id,
        type,
        label: `Тест Telegram для ${params.email}`,
        params,
      };
    case "save_vps_ip":
      return {
        id,
        type,
        label: `Сохранить IP ${params.vpsIp} для ${params.email}`,
        params,
      };
    case "create_partner":
      const missing: string[] = [];
      if (!params.email) missing.push("email");
      if (!params.password) missing.push("password");
      if (!params.profiLogin) missing.push("profiLogin");
      if (!params.profiPassword) missing.push("profiPassword");
      return {
        id,
        type,
        label: `Создать партнёра ${params.email || "?"}`,
        params: { ...params, leadsPerMonth: params.leadsPerMonth || 500 },
        missing,
      };
    default:
      return null;
  }
}
