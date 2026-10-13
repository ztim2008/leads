import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/guard";
import { addBriefsEmail, getBriefsEmails, normalizeBriefEmail, removeBriefsEmail } from "@/lib/briefs/access";
import { db } from "@/lib/db";

async function enrich(emails: string[]) {
  const users = await db.user.findMany({
    where: { email: { in: emails, mode: "insensitive" } },
    select: { email: true, role: true, firstName: true, loginEnabled: true },
  });
  const byEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  return emails.map((email) => {
    const user = byEmail.get(email.toLowerCase());
    return {
      email,
      exists: !!user,
      role: user?.role || null,
      firstName: user?.firstName || null,
      loginEnabled: user?.loginEnabled ?? null,
    };
  });
}

export async function GET() {
  const gate = await requireAdminUser();
  if (gate.error) return gate.error;
  const emails = await getBriefsEmails();
  return NextResponse.json({ entries: await enrich(emails) });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminUser();
  if (gate.error) return gate.error;
  const body = await req.json().catch(() => ({}));
  const email = normalizeBriefEmail(body.email);
  try {
    const result = await addBriefsEmail(email);
    return NextResponse.json({ ok: true, added: result.added, entries: await enrich(result.emails) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не добавилось" },
      { status: 400 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdminUser();
  if (gate.error) return gate.error;
  const body = await req.json().catch(() => ({}));
  const email = normalizeBriefEmail(body.email);
  if (!email) return NextResponse.json({ error: "Укажите email" }, { status: 400 });
  const emails = await removeBriefsEmail(email);
  return NextResponse.json({ ok: true, entries: await enrich(emails) });
}
