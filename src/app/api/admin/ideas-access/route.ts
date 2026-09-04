import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/guard";
import {
  addIdeasBoardEmail,
  getIdeasBoardEmails,
  normalizeIdeasEmail,
  removeIdeasBoardEmail,
} from "@/lib/ideas/access";
import { db } from "@/lib/db";

async function enrich(emails: string[]) {
  const users = await db.user.findMany({
    where: { email: { in: emails, mode: "insensitive" } },
    select: { email: true, role: true, firstName: true, loginEnabled: true },
  });
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  return emails.map((email) => {
    const u = byEmail.get(email.toLowerCase());
    return {
      email,
      exists: !!u,
      role: u?.role || null,
      firstName: u?.firstName || null,
      loginEnabled: u?.loginEnabled ?? null,
    };
  });
}

/** GET — whitelist Ideas Board */
export async function GET() {
  const gate = await requireAdminUser();
  if (gate.error) return gate.error;

  const emails = await getIdeasBoardEmails();
  return NextResponse.json({
    emails,
    entries: await enrich(emails),
    note: "Админы всегда имеют доступ к /dashboard/ideas. Whitelist — для партнёров.",
  });
}

/** POST { email } — выдать доступ */
export async function POST(req: NextRequest) {
  const gate = await requireAdminUser();
  if (gate.error) return gate.error;

  const body = await req.json().catch(() => ({}));
  const email = normalizeIdeasEmail(body.email);
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Укажите корректный email" }, { status: 400 });
  }

  try {
    const result = await addIdeasBoardEmail(email);
    return NextResponse.json({
      ok: true,
      added: result.added,
      emails: result.emails,
      entries: await enrich(result.emails),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ошибка" },
      { status: 400 },
    );
  }
}

/** DELETE { email } — отозвать доступ */
export async function DELETE(req: NextRequest) {
  const gate = await requireAdminUser();
  if (gate.error) return gate.error;

  const body = await req.json().catch(() => ({}));
  const email = normalizeIdeasEmail(body.email);
  if (!email) {
    return NextResponse.json({ error: "Укажите email" }, { status: 400 });
  }

  const result = await removeIdeasBoardEmail(email);
  return NextResponse.json({
    ok: true,
    removed: result.removed,
    emails: result.emails,
    entries: await enrich(result.emails),
  });
}
