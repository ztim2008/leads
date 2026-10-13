import { auth } from "@/lib/auth/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { getAppConfig, updateAppConfig } from "@/lib/config/app";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export function normalizeBriefEmail(email: string | null | undefined): string {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function uniqEmails(list: string[]): string[] {
  return Array.from(new Set(list.map(normalizeBriefEmail).filter(Boolean)));
}

export async function getBriefsEmails(): Promise<string[]> {
  const cfg = await getAppConfig();
  const stored = Array.isArray(cfg.briefsEmails) ? cfg.briefsEmails : [];
  return uniqEmails(stored);
}

export async function addBriefsEmail(email: string): Promise<{ emails: string[]; added: boolean }> {
  const normalized = normalizeBriefEmail(email);
  if (!normalized.includes("@")) throw new Error("Укажите корректный email");
  const user = await db.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
    select: { id: true, loginEnabled: true },
  });
  if (!user) throw new Error("Такого пользователя нет. Сначала он должен входить в систему.");
  if (!user.loginEnabled) throw new Error("Вход этой учётке запрещён.");
  const emails = await getBriefsEmails();
  if (emails.includes(normalized)) return { emails, added: false };
  const next = [...emails, normalized];
  await updateAppConfig({ briefsEmails: next });
  return { emails: next, added: true };
}

export async function removeBriefsEmail(email: string): Promise<string[]> {
  const normalized = normalizeBriefEmail(email);
  const next = (await getBriefsEmails()).filter((item) => item !== normalized);
  await updateAppConfig({ briefsEmails: next });
  return next;
}

export type BriefsActor = {
  id: string;
  email: string;
  role: string;
  isAdmin: boolean;
};

/** Админ всегда. Директолог — только если главный админ добавил его email. */
export async function canAccessBriefs(
  email: string | null | undefined,
  role: string | null | undefined,
  impersonating: boolean,
): Promise<boolean> {
  if (impersonating || !email) return false;
  if (isAdminRole(role)) return true;
  const allowed = await getBriefsEmails();
  return allowed.includes(normalizeBriefEmail(email));
}

export async function getBriefsActor(): Promise<BriefsActor | null> {
  const session = await auth();
  const sessionUser = session?.user as { email?: string; impersonatorId?: string } | undefined;
  if (!sessionUser?.email || sessionUser.impersonatorId) return null;
  const email = normalizeBriefEmail(sessionUser.email);
  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, role: true, loginEnabled: true },
  });
  if (!user?.loginEnabled) return null;
  if (isAdminRole(user.role)) {
    return { id: user.id, email: user.email, role: user.role, isAdmin: true };
  }
  const allowed = await getBriefsEmails();
  if (!allowed.includes(normalizeBriefEmail(user.email))) return null;
  return { id: user.id, email: user.email, role: user.role, isAdmin: false };
}

export async function requireBriefsUser() {
  const actor = await getBriefsActor();
  if (!actor) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { actor };
}
