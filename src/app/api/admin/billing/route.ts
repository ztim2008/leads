import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import {
  getQuotaStatus,
  renewPartnerMonth,
  setCollectionEnabled,
} from "@/lib/billing/quota";

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

  const rows = partners.map((p) => {
    const ws = p.workspaces[0];
    const sub = p.subscription;
    const quota = sub
      ? {
          used: sub.leadsUsedMonth,
          limit: sub.leadsPerMonth,
          remaining: Math.max(0, sub.leadsPerMonth - sub.leadsUsedMonth),
          collectionEnabled: sub.collectionEnabled,
          expiresAt: sub.expiresAt?.toISOString() || null,
          expired: sub.expiresAt ? sub.expiresAt.getTime() < Date.now() : false,
        }
      : null;
    const source = ws?.sources[0];
    const cfg = (source?.config as { login?: string; _lastHeartbeat?: string }) || {};
    return {
      userId: p.id,
      email: p.email,
      name: p.firstName || p.email,
      workspaceId: ws?.id,
      profiLogin: cfg.login || null,
      sourceEnabled: source?.enabled ?? false,
      agentOnline: cfg._lastHeartbeat
        ? Date.now() - new Date(cfg._lastHeartbeat).getTime() < 15 * 60 * 1000
        : false,
      quota,
      plan: sub?.plan || "none",
      status: sub?.status || "none",
    };
  });

  const active = rows.filter((r) => r.quota?.collectionEnabled && !r.quota?.expired).length;
  const paused = rows.filter((r) => r.quota && (!r.quota.collectionEnabled || r.quota.expired)).length;
  const nearLimit = rows.filter(
    (r) => r.quota && r.quota.limit > 0 && r.quota.used / r.quota.limit >= 0.8,
  ).length;

  return NextResponse.json({
    partners: rows,
    summary: { total: rows.length, active, paused, nearLimit },
  });
}

export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user) return NextResponse.json({ error: "Unauth" }, { status: 401 });
  const u = await db.user.findUnique({ where: { email: (s.user as { email?: string }).email } });
  if (!u || u.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { action, workspaceId, leadsPerMonth, enabled } = body;

  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  switch (action) {
    case "renew":
      await renewPartnerMonth(workspaceId, leadsPerMonth ? parseInt(String(leadsPerMonth)) : undefined);
      break;
    case "toggle":
      await setCollectionEnabled(workspaceId, Boolean(enabled));
      break;
    case "set_limit":
      const limit = parseInt(String(leadsPerMonth)) || 500;
      const sub = await db.subscription.findFirst({ where: { workspaceId } });
      if (sub) {
        await db.subscription.update({ where: { id: sub.id }, data: { leadsPerMonth: limit } });
      }
      break;
    case "reset_counter":
      const existing = await db.subscription.findFirst({ where: { workspaceId } });
      if (existing) {
        await db.subscription.update({
          where: { id: existing.id },
          data: { leadsUsedMonth: 0, quotaPeriodStart: new Date() },
        });
      }
      break;
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  const quota = await getQuotaStatus(workspaceId);
  return NextResponse.json({ ok: true, quota });
}
