import { NextRequest, NextResponse } from "next/server";
import { assertOwnsClient, requireCrmUser } from "@/lib/crm/guard";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireCrmUser();
  if (gate.error) return gate.error;
  const { id: clientId } = await ctx.params;

  const client = await db.crmClient.findUnique({ where: { id: clientId } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = assertOwnsClient(client, gate.user.id, gate.isAdmin);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const type = String(body.type || "other");
  const value = String(body.value || "").trim();
  if (!value) return NextResponse.json({ error: "Укажите контакт" }, { status: 400 });

  if (body.isPrimary) {
    await db.crmContact.updateMany({
      where: { clientId },
      data: { isPrimary: false },
    });
  }

  const contact = await db.crmContact.create({
    data: {
      clientId,
      type,
      value,
      label: body.label ? String(body.label).trim() : null,
      isPrimary: Boolean(body.isPrimary),
    },
  });

  return NextResponse.json({ ok: true, contact });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireCrmUser();
  if (gate.error) return gate.error;
  const { id: clientId } = await ctx.params;
  const contactId = req.nextUrl.searchParams.get("contactId");
  if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 });

  const client = await db.crmClient.findUnique({ where: { id: clientId } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = assertOwnsClient(client, gate.user.id, gate.isAdmin);
  if (denied) return denied;

  const contact = await db.crmContact.findFirst({ where: { id: contactId, clientId } });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.crmContact.delete({ where: { id: contactId } });
  return NextResponse.json({ ok: true });
}
