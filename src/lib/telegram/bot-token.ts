import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { db } from "@/lib/db";

/** Подхватить `.env` для PM2/tsx (Next.js делает это сам). */
export function loadHubEnv(): void {
  const p = join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

export type BotTokenSource = "env" | "db" | "none";

export async function resolveServiceBotToken(): Promise<{ token: string; source: BotTokenSource }> {
  const env = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (env) return { token: env, source: "env" };

  const rows = await db.settings.findMany({
    where: { telegramToken: { not: null } },
    select: { telegramToken: true, workspace: { select: { user: { select: { role: true } } } } },
    take: 30,
  });
  const prefer = rows.find((r) => r.workspace.user.role !== "admin" && r.telegramToken?.trim())
    || rows.find((r) => r.telegramToken?.trim());
  const token = (prefer?.telegramToken || "").trim();
  if (token) return { token, source: "db" };
  return { token: "", source: "none" };
}

export async function telegramGetMe(token: string): Promise<{ ok: boolean; username?: string }> {
  if (!token) return { ok: false };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(8000) });
    const d = (await r.json()) as { ok?: boolean; result?: { username?: string } };
    if (d.ok) return { ok: true, username: d.result?.username };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}
