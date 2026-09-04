import { db } from "@/lib/db";

export type IdeaUserBrief = {
  id: string;
  email: string;
  firstName: string | null;
};

export async function loadUsersByIds(ids: string[]): Promise<Map<string, IdeaUserBrief>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const users = await db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, email: true, firstName: true },
  });
  return new Map(users.map((u) => [u.id, u]));
}

export function displayName(u: IdeaUserBrief | undefined | null, fallbackId?: string): string {
  if (!u) return fallbackId ? `user:${fallbackId.slice(0, 8)}` : "—";
  return u.firstName || u.email;
}
