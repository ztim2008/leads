import { NextRequest, NextResponse } from "next/server";
import { requireCrmUser } from "@/lib/crm/guard";
import { dateInputToNextStepAt, mskTodayBounds } from "@/lib/crm/due";
import { CRM_STATUS_IDS, isConnectedStatus } from "@/lib/crm/statuses";
import { db } from "@/lib/db";

function serializeClient(c: {
  id: string;
  name: string;
  niche: string | null;
  city: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  nextStep: string | null;
  nextStepAt: Date | null;
  ownerId: string | null;
  createdById: string | null;
  linkedWorkspaceId: string | null;
  createdAt: Date;
  updatedAt: Date;
  owner?: { id: string; email: string; firstName: string | null } | null;
  contacts?: { id: string; type: string; value: string; label: string | null; isPrimary: boolean }[];
  linkedWorkspace?: {
    id: string;
    name: string;
    user: { id: string; email: string; firstName: string | null };
  } | null;
}) {
  return {
    id: c.id,
    name: c.name,
    niche: c.niche,
    city: c.city,
    status: c.status,
    connected: isConnectedStatus(c.status) && !!c.linkedWorkspaceId,
    source: c.source,
    notes: c.notes,
    nextStep: c.nextStep,
    nextStepAt: c.nextStepAt?.toISOString() || null,
    ownerId: c.ownerId,
    owner: c.owner
      ? { id: c.owner.id, email: c.owner.email, name: c.owner.firstName || c.owner.email }
      : null,
    createdById: c.createdById,
    linkedWorkspaceId: c.linkedWorkspaceId,
    linkedPartner: c.linkedWorkspace
      ? {
          workspaceId: c.linkedWorkspace.id,
          workspaceName: c.linkedWorkspace.name,
          email: c.linkedWorkspace.user.email,
          name: c.linkedWorkspace.user.firstName || c.linkedWorkspace.user.email,
          partnerId: c.linkedWorkspace.user.id,
        }
      : null,
    contacts: c.contacts || [],
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

const include = {
  owner: { select: { id: true, email: true, firstName: true } },
  contacts: { orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }] },
  linkedWorkspace: {
    select: {
      id: true,
      name: true,
      user: { select: { id: true, email: true, firstName: true } },
    },
  },
};

function parseNextStepAt(raw: unknown): Date | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return dateInputToNextStepAt(raw);
  }
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const gate = await requireCrmUser();
  if (gate.error) return gate.error;

  const status = req.nextUrl.searchParams.get("status");
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const readyQueue = req.nextUrl.searchParams.get("ready") === "1";
  const due = req.nextUrl.searchParams.get("due"); // today | overdue
  const adminMineOnly = gate.isAdmin && req.nextUrl.searchParams.get("mine") === "1";

  const ownerFilter: { ownerId?: string } =
    !gate.isAdmin || adminMineOnly ? { ownerId: gate.user.id } : {};

  const { start: todayStart, end: todayEnd } = mskTodayBounds();

  const where: Record<string, unknown> = { ...ownerFilter };
  if (readyQueue) where.status = "ready";
  else if (status && CRM_STATUS_IDS.includes(status as (typeof CRM_STATUS_IDS)[number])) {
    where.status = status;
  }
  if (due === "today") {
    where.nextStepAt = { gte: todayStart, lt: todayEnd };
  } else if (due === "overdue") {
    where.nextStepAt = { lt: todayStart };
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { niche: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { nextStep: { contains: q, mode: "insensitive" } },
      { contacts: { some: { value: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const orderBy =
    due === "today" || due === "overdue"
      ? [{ nextStepAt: "asc" as const }]
      : [{ updatedAt: "desc" as const }];

  const clients = await db.crmClient.findMany({
    where,
    include,
    orderBy,
    take: 200,
  });

  const counts = await db.crmClient.groupBy({
    by: ["status"],
    where: ownerFilter,
    _count: { _all: true },
  });

  const [dueTodayCount, overdueCount] = await Promise.all([
    db.crmClient.count({
      where: { ...ownerFilter, nextStepAt: { gte: todayStart, lt: todayEnd } },
    }),
    db.crmClient.count({
      where: { ...ownerFilter, nextStepAt: { lt: todayStart } },
    }),
  ]);

  return NextResponse.json({
    clients: clients.map(serializeClient),
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    readyCount: counts.find((c) => c.status === "ready")?._count._all || 0,
    dueTodayCount,
    overdueCount,
    scope: gate.isAdmin && !adminMineOnly ? "all" : "mine",
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireCrmUser();
  if (gate.error) return gate.error;

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Укажите имя" }, { status: 400 });

  const status = String(body.status || "lead");
  if (!CRM_STATUS_IDS.includes(status as (typeof CRM_STATUS_IDS)[number])) {
    return NextResponse.json({ error: "Неверный статус" }, { status: 400 });
  }

  // Напарник всегда владелец сам. Админ может назначить ownerId (себе по умолчанию).
  let ownerId = gate.user.id;
  if (gate.isAdmin && body.ownerId) {
    ownerId = String(body.ownerId);
  }

  const client = await db.crmClient.create({
    data: {
      name,
      niche: body.niche ? String(body.niche).trim() : null,
      city: body.city ? String(body.city).trim() : null,
      status,
      source: body.source ? String(body.source).trim() : null,
      notes: body.notes ? String(body.notes).trim() : null,
      nextStep: body.nextStep ? String(body.nextStep).trim() : null,
      nextStepAt: parseNextStepAt(body.nextStepAt),
      ownerId,
      createdById: gate.user.id,
    },
    include,
  });

  const contacts = Array.isArray(body.contacts) ? body.contacts : [];
  for (const c of contacts.slice(0, 10)) {
    const type = String(c.type || "other");
    const value = String(c.value || "").trim();
    if (!value) continue;
    await db.crmContact.create({
      data: {
        clientId: client.id,
        type,
        value,
        label: c.label ? String(c.label).trim() : null,
        isPrimary: Boolean(c.isPrimary),
      },
    });
  }

  const full = await db.crmClient.findUnique({ where: { id: client.id }, include });
  return NextResponse.json({ ok: true, client: serializeClient(full!) });
}
