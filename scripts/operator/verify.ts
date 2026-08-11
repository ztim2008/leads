import { db } from "../../src/lib/db";
import { getQuotaStatus } from "../../src/lib/billing/quota";

const API_URL = process.env.NEXT_PUBLIC_URL || "https://leads.konversus.ru";

export interface VerifyCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export async function verifyPartner(email: string): Promise<{ ok: boolean; checks: VerifyCheck[] }> {
  const checks: VerifyCheck[] = [];

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

  if (!user) {
    return {
      ok: false,
      checks: [{ name: "user", ok: false, detail: "Пользователь не найден" }],
    };
  }

  checks.push({ name: "user", ok: true, detail: `${user.email} (${user.role})` });

  const ws = user.workspaces[0];
  if (!ws) {
    checks.push({ name: "workspace", ok: false, detail: "Нет workspace" });
    return { ok: false, checks };
  }
  checks.push({ name: "workspace", ok: true, detail: ws.id });

  const sub = user.subscription;
  const quota = await getQuotaStatus(ws.id);
  checks.push({
    name: "quota",
    ok: quota.allowed,
    detail: `${quota.used}/${quota.limit}, сбор ${quota.allowed ? "вкл" : quota.reason || "стоп"}`,
  });

  if (sub?.expiresAt) {
    const expired = sub.expiresAt.getTime() < Date.now();
    checks.push({
      name: "period",
      ok: !expired,
      detail: `до ${sub.expiresAt.toLocaleDateString("ru")}${expired ? " (истёк)" : ""}`,
    });
  }

  const settings = ws.settings;
  const hasTg = !!(settings?.telegramChatId && settings?.telegramToken);
  checks.push({
    name: "telegram",
    ok: hasTg,
    detail: hasTg ? `chat ${settings!.telegramChatId}` : "не настроен",
  });

  const source = ws.sources.find((s) => s.platform === "profi") || ws.sources[0];
  if (!source) {
    checks.push({ name: "profi_source", ok: false, detail: "Source не создан" });
    return { ok: false, checks };
  }

  const cfg = (source.config as Record<string, unknown>) || {};
  checks.push({
    name: "profi_source",
    ok: !!(cfg.login && cfg.password),
    detail: `login=${cfg.login || "—"}, enabled=${source.enabled}`,
  });

  const hb = cfg._lastHeartbeat as string | undefined;
  const online = hb ? Date.now() - new Date(hb).getTime() < 15 * 60 * 1000 : false;
  checks.push({
    name: "agent_heartbeat",
    ok: online,
    detail: hb
      ? `${online ? "online" : "offline"}, last ${new Date(hb).toLocaleString("ru")}`
      : "нет heartbeat — агент не установлен?",
  });

  const vpsIp = cfg._vpsIp as string | undefined;
  checks.push({
    name: "vps_ip",
    ok: !!vpsIp,
    detail: vpsIp || "IP не записан",
  });

  const install = `curl -fsSL ${API_URL}/agent/v2/install.sh | bash -s "${source.id}"`;
  checks.push({ name: "install_cmd", ok: true, detail: install });

  checks.push({
    name: "leads_count",
    ok: ws._count.leads > 0,
    detail: `${ws._count.leads} в базе`,
  });

  const cb = cfg._circuitBreaker as { state?: string } | undefined;
  if (cb?.state) {
    checks.push({
      name: "circuit_breaker",
      ok: cb.state === "CLOSED" || cb.state === "HALF_OPEN",
      detail: cb.state,
    });
  }

  const ok = checks.filter((c) => c.name !== "leads_count").every((c) => c.ok || c.name === "telegram");
  return { ok, checks };
}

export function printChecks(checks: VerifyCheck[]): void {
  for (const c of checks) {
    console.log(`${c.ok ? "✅" : "❌"} ${c.name}: ${c.detail}`);
  }
}
