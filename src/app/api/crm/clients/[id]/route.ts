import { NextRequest, NextResponse } from "next/server";
import { assertOwnsClient, requireCrmUser } from "@/lib/crm/guard";
import { isAdminRole } from "@/lib/auth/roles";
import { dateInputToNextStepAt } from "@/lib/crm/due";
import { CRM_STATUS_IDS, isConnectedStatus } from "@/lib/crm/statuses";
import { db } from "@/lib/db";

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

function serialize(c: NonNullable<Awaited<ReturnType<typeof loadClient>>>) {
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
    contacts: c.contacts,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

async function loadClient(id: string) {
  return db.crmClient.findUnique({ where: { id }, include });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireCrmUser();
  if (gate.error) return gate.error;
  const { id } = await ctx.params;
  const c = await loadClient(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = assertOwnsClient(c, gate.user.id, gate.isAdmin);
  if (denied) return denied;
  return NextResponse.json({ client: serialize(c) });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireCrmUser();
  if (gate.error) return gate.error;
  const { id } = await ctx.params;
  const existing = await loadClient(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = assertOwnsClient(existing, gate.user.id, gate.isAdmin);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.name != null) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Имя пустое" }, { status: 400 });
    data.name = name;
  }
  if (body.niche !== undefined) data.niche = body.niche ? String(body.niche).trim() : null;
  if (body.city !== undefined) data.city = body.city ? String(body.city).trim() : null;
  if (body.source !== undefined) data.source = body.source ? String(body.source).trim() : null;
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;
  if (body.nextStep !== undefined) data.nextStep = body.nextStep ? String(body.nextStep).trim() : null;
  if (body.nextStepAt !== undefined) {
    if (body.nextStepAt == null || body.nextStepAt === "") {
      data.nextStepAt = null;
    } else if (typeof body.nextStepAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.nextStepAt)) {
      data.nextStepAt = dateInputToNextStepAt(body.nextStepAt);
    } else {
      const d = new Date(String(body.nextStepAt));
      data.nextStepAt = Number.isNaN(d.getTime()) ? null : d;
    }
  }
  if (body.status != null) {
    const status = String(body.status);
    if (!CRM_STATUS_IDS.includes(status as (typeof CRM_STATUS_IDS)[number])) {
      return NextResponse.json({ error: "Неверный статус" }, { status: 400 });
    }
    data.status = status;
  }
  // Переназначение владельца — только админ (напарник не может забрать чужих / отдать)
  if (body.ownerId !== undefined && isAdminRole(gate.user.role)) {
    data.ownerId = body.ownerId ? String(body.ownerId) : null;
  }

  if (body.linkedWorkspaceId !== undefined) {
    if (!gate.isAdmin) {
      return NextResponse.json({ error: "Связь с партнёром — только админ" }, { status: 403 });
    }
    const wsId = body.linkedWorkspaceId ? String(body.linkedWorkspaceId) : null;
    if (wsId) {
      const ws = await db.workspace.findUnique({
        where: { id: wsId },
        include: { user: true },
      });
      if (!ws || ws.user.role !== "user") {
        return NextResponse.json({ error: "Workspace партнёра не найден" }, { status: 400 });
      }
      data.linkedWorkspaceId = wsId;
      if (!body.status) data.status = "connected";
    } else {
      data.linkedWorkspaceId = null;
    }
  }

  await db.crmClient.update({ where: { id }, data });
  const full = await loadClient(id);
  return NextResponse.json({ ok: true, client: serialize(full!) });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireCrmUser();
  if (gate.error) return gate.error;
  if (!gate.isAdmin) {
    return NextResponse.json({ error: "Удаление — только админ" }, { status: 403 });
  }
  const { id } = await ctx.params;
  await db.crmClient.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
