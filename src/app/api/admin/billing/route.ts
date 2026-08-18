import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import {
  getQuotaStatus,
  renewPartnerMonth,
  setCollectionEnabled,
  pausePartnerBilling,
  resumePartnerBilling,
  setUnlimitedBilling,
  setPeriodPaid,
} from "@/lib/billing/quota";
import { billingViewFor } from "@/lib/billing/view";
import { getAppConfig, updateAppConfig } from "@/lib/config/app";
import { nInt, pricesFromConfig, pricesFromSub } from "@/lib/billing/operator-pricing";

export async function GET() {
  const s = await auth();
  if (!s?.user) return NextResponse.json({ error: "Unauth" }, { status: 401 });
  const u = await db.user.findUnique({ where: { email: (s.user as { email?: string }).email } });
  if (!u || u.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const partners = await db.user.findMany({
    where: { role: { not: "admin" } },
    include: {
      workspaces: {
        include: {
          sources: { select: { id: true, enabled: true, status: true, config: true } },
        },
      },
      subscription: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = await Promise.all(partners.map(async (p) => {
    const ws = p.workspaces[0];
    const sub = p.subscription;
    const view = sub ? await billingViewFor(sub, p.createdAt, ws?.id) : null;
    const billing = view?.report || null;
    const calendar = view?.calendar || [];
    const quota = sub
      ? {
          used: sub.leadsUsedMonth,
          limit: sub.leadsPerMonth,
          remaining: Math.max(0, sub.leadsPerMonth - sub.leadsUsedMonth),
          collectionEnabled: sub.collectionEnabled,
          expiresAt: sub.expiresAt?.toISOString() || null,
          expired: billing?.expired ?? false,
        }
      : null;
    const source = ws?.sources[0];
    const cfg = (source?.config as { login?: string; _lastHeartbeat?: string }) || {};
    return {
      userId: p.id,
      email: p.email,
      name: p.firstName || p.email,
      workspaceId: ws?.id,
      connectedAt: p.createdAt.toISOString(),
      profiLogin: cfg.login || null,
      sourceEnabled: source?.enabled ?? false,
      agentOnline: cfg._lastHeartbeat
        ? Date.now() - new Date(cfg._lastHeartbeat).getTime() < 15 * 60 * 1000
        : false,
      quota,
      billing,
      calendar,
      prices: sub ? pricesFromSub(sub) : null,
      periodIndex: sub?.periodIndex ?? 1,
      plan: sub?.plan || "none",
      status: sub?.status || "none",
    };
  }));

  const active = rows.filter((r) => r.quota?.collectionEnabled && !r.billing?.expired && !r.billing?.paused).length;
  const paused = rows.filter((r) => r.billing?.paused || (r.quota && !r.quota.collectionEnabled)).length;
  const dueSum = rows.reduce((n, r) => n + (r.billing?.dueNow || 0), 0);

  const defaults = pricesFromConfig(await getAppConfig());

  return NextResponse.json({
    partners: rows,
    summary: { total: rows.length, active, paused, dueSum },
    defaults,
  });
}

export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user) return NextResponse.json({ error: "Unauth" }, { status: 401 });
  const u = await db.user.findUnique({ where: { email: (s.user as { email?: string }).email } });
  if (!u || u.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { action, workspaceId, leadsPerMonth, enabled } = body;

  if (action === "set_defaults") {
    const cur = pricesFromConfig(await getAppConfig());
    await updateAppConfig({
      operatorConnectFeeRub: nInt(body.connectFeeRub, cur.connectFeeRub),
      operatorAiApiRub: nInt(body.aiApiRub, cur.aiApiRub),
      operatorAiApiUsd: nInt(body.aiApiUsd, cur.aiApiUsd),
      operatorSupportFeeRub: nInt(body.supportFeeRub, cur.supportFeeRub),
      operatorVpsPerDayRub: nInt(body.vpsPerDayRub, cur.vpsPerDayRub),
    });
    return NextResponse.json({ ok: true, defaults: pricesFromConfig(await getAppConfig()) });
  }

  if (action === "apply_defaults") {
    const d = pricesFromConfig(await getAppConfig());
    await db.subscription.updateMany({
      data: {
        connectFeeRub: d.connectFeeRub,
        aiApiRub: d.aiApiRub,
        aiApiUsd: d.aiApiUsd,
        supportFeeRub: d.supportFeeRub,
        vpsPerDayRub: d.vpsPerDayRub,
      },
    });
    return NextResponse.json({ ok: true, defaults: d });
  }

  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  switch (action) {
    case "renew":
      await renewPartnerMonth(workspaceId, leadsPerMonth ? parseInt(String(leadsPerMonth)) : undefined);
      break;
    case "pause":
      await pausePartnerBilling(workspaceId);
      break;
    case "resume":
      await resumePartnerBilling(workspaceId);
      break;
    case "unlimited":
      await setUnlimitedBilling(workspaceId);
      break;
    case "toggle":
      await setCollectionEnabled(workspaceId, Boolean(enabled));
      break;
    case "set_limit": {
      const limit = parseInt(String(leadsPerMonth)) || 500;
      const sub = await db.subscription.findFirst({ where: { workspaceId } });
      if (sub) {
        await db.subscription.update({ where: { id: sub.id }, data: { leadsPerMonth: limit } });
      }
      break;
    }
    case "set_prices": {
      const sub = await db.subscription.findFirst({ where: { workspaceId } });
      if (sub) {
        await db.subscription.update({
          where: { id: sub.id },
          data: {
            connectFeeRub: nInt(body.connectFeeRub, sub.connectFeeRub),
            vpsPerDayRub: nInt(body.vpsPerDayRub, sub.vpsPerDayRub),
            aiApiRub: nInt(body.aiApiRub, sub.aiApiRub),
            aiApiUsd: nInt(body.aiApiUsd, sub.aiApiUsd),
            supportFeeRub: nInt(body.supportFeeRub, sub.supportFeeRub),
          },
        });
      }
      break;
    }
    case "set_paid":
      await setPeriodPaid(workspaceId, Boolean(body.paid), body.periodStart ? String(body.periodStart) : undefined);
      break;
    case "reset_counter": {
      const existing = await db.subscription.findFirst({ where: { workspaceId } });
      if (existing) {
        await db.subscription.update({
          where: { id: existing.id },
          data: { leadsUsedMonth: 0, quotaPeriodStart: new Date() },
        });
      }
      break;
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  const quota = await getQuotaStatus(workspaceId);
  return NextResponse.json({ ok: true, quota });
}
