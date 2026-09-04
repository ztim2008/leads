import { getAppConfig, updateAppConfig } from "@/lib/config/app";
import { isAdminRole } from "@/lib/auth/roles";

const DEFAULT_SEED = "bilariuss@yandex.ru";

export function normalizeIdeasEmail(email: string | null | undefined): string {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/** Env seed (comma-separated). Used when DB list is empty / as founder fallback until ops fills DB. */
export function ideasBoardSeedEmails(): string[] {
  const raw = process.env.IDEAS_BOARD_EMAILS || DEFAULT_SEED;
  return raw
    .split(",")
    .map((e) => normalizeIdeasEmail(e))
    .filter(Boolean);
}

function uniqEmails(list: string[]): string[] {
  return Array.from(new Set(list.map(normalizeIdeasEmail).filter(Boolean)));
}

/**
 * Whitelist from AppConfig. If empty — seed from IDEAS_BOARD_EMAILS (or founder)
 * and persist once so ops UI can edit/revoke.
 */
export async function getIdeasBoardEmails(): Promise<string[]> {
  const cfg = await getAppConfig();
  const stored = Array.isArray(cfg.ideasBoardEmails) ? cfg.ideasBoardEmails : [];
  const normalized = uniqEmails(stored);
  if (normalized.length > 0) return normalized;

  const seed = uniqEmails(ideasBoardSeedEmails());
  if (seed.length === 0) return [];
  await updateAppConfig({ ideasBoardEmails: seed });
  return seed;
}

export async function setIdeasBoardEmails(emails: string[]): Promise<string[]> {
  const next = uniqEmails(emails);
  await updateAppConfig({ ideasBoardEmails: next });
  return next;
}

export async function addIdeasBoardEmail(email: string): Promise<{ emails: string[]; added: boolean }> {
  const normalized = normalizeIdeasEmail(email);
  if (!normalized || !normalized.includes("@")) {
    throw new Error("Некорректный email");
  }
  const current = await getIdeasBoardEmails();
  if (current.includes(normalized)) {
    return { emails: current, added: false };
  }
  const emails = await setIdeasBoardEmails([...current, normalized]);
  return { emails, added: true };
}

export async function removeIdeasBoardEmail(email: string): Promise<{ emails: string[]; removed: boolean }> {
  const normalized = normalizeIdeasEmail(email);
  const current = await getIdeasBoardEmails();
  if (!current.includes(normalized)) {
    return { emails: current, removed: false };
  }
  const emails = await setIdeasBoardEmails(current.filter((e) => e !== normalized));
  return { emails, removed: true };
}

/**
 * Доступ к Ideas Board:
 * — admin всегда;
 * — остальные — только email из whitelist (AppConfig.ideasBoardEmails).
 */
export async function canAccessIdeas(
  email: string | null | undefined,
  role?: string | null,
): Promise<boolean> {
  if (isAdminRole(role)) return true;
  const normalized = normalizeIdeasEmail(email);
  if (!normalized) return false;
  const list = await getIdeasBoardEmails();
  return list.includes(normalized);
}
