import crypto from "crypto";
import fs from "fs";
import path from "path";

export const RABOTA_REDIRECT_URI = "https://leads.konversus.ru/api/radar/rabota/callback";

const TOKEN_FILE = path.join(process.cwd(), ".rabota-token.json");

export type RabotaCreds = { appId: string; secret: string };

export function rabotaCredentials(): RabotaCreds | null {
  const appId = process.env.RABOTA_APP_ID?.trim() || "";
  const secret = process.env.RABOTA_APP_SECRET?.trim() || "";
  if (!appId || !secret) return null;
  return { appId, secret };
}

/** Подпись запроса Rabota.ru: ключи по алфавиту, JSON без пробелов, sha256. */
export function rabotaSignature(params: Record<string, string>, secret: string): string {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(params).sort()) sorted[key] = String(params[key]);
  return crypto.createHash("sha256").update(JSON.stringify(sorted) + secret).digest("hex");
}

export function rabotaAuthorizeUrl(creds: RabotaCreds): string {
  const state = crypto.createHmac("sha256", creds.secret).update("rabota-oauth-v1").digest("hex").slice(0, 32);
  const query = new URLSearchParams({
    app_id: creds.appId,
    scope: "profile,vacancies",
    display: "page",
    redirect_uri: RABOTA_REDIRECT_URI,
    state,
  });
  return `https://api.rabota.ru/oauth/authorize.html?${query}`;
}

export function rabotaStateOk(state: string | null, secret: string): boolean {
  if (!state) return true;
  const expected = crypto.createHmac("sha256", secret).update("rabota-oauth-v1").digest("hex").slice(0, 32);
  return state === expected;
}

export async function exchangeRabotaCode(code: string, creds: RabotaCreds): Promise<{ accessToken: string; expiresIn: number }> {
  const params: Record<string, string> = {
    app_id: creds.appId,
    time: String(Math.floor(Date.now() / 1000)),
    code,
  };
  params.signature = rabotaSignature(params, creds.secret);
  const response = await fetch("https://api.rabota.ru/oauth/token.json", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let data: { access_token?: string; expires_in?: number; error?: string; message?: string } = {};
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new Error(`Rabota.ru ответила не JSON (${response.status})`);
  }
  if (!response.ok || !data.access_token) {
    throw new Error(data.message || data.error || `Не удалось получить токен (${response.status})`);
  }
  return { accessToken: data.access_token, expiresIn: Number(data.expires_in) || 0 };
}

export function readRabotaToken(): { accessToken: string; expiresAt: Date } | null {
  try {
    const raw = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")) as { accessToken?: string; expiresAt?: string };
    if (!raw.accessToken || !raw.expiresAt) return null;
    const expiresAt = new Date(raw.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) return null;
    return { accessToken: raw.accessToken, expiresAt };
  } catch {
    return null;
  }
}

export async function refreshRabotaToken(
  accessToken: string,
  creds: RabotaCreds,
): Promise<{ accessToken: string; expiresIn: number }> {
  const params: Record<string, string> = {
    app_id: creds.appId,
    time: String(Math.floor(Date.now() / 1000)),
    token: accessToken,
  };
  params.signature = rabotaSignature(params, creds.secret);
  const response = await fetch("https://api.rabota.ru/oauth/refresh-token.json", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let data: { access_token?: string; expires_in?: number; error?: string; message?: string } = {};
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new Error(`Rabota.ru не обновила токен (${response.status})`);
  }
  if (!response.ok || !data.access_token) {
    throw new Error(data.message || data.error || `Не удалось обновить токен (${response.status})`);
  }
  return { accessToken: data.access_token, expiresIn: Number(data.expires_in) || 0 };
}

/** Токен с диска. За шесть часов до конца — обновление. Секрет и токен наружу не пишем. */
export async function ensureRabotaAccess(): Promise<{ appId: string; accessToken: string } | null> {
  const creds = rabotaCredentials();
  const stored = readRabotaToken();
  if (!creds || !stored) return null;
  const refreshAt = stored.expiresAt.getTime() - 6 * 60 * 60 * 1000;
  if (Date.now() < refreshAt) return { appId: creds.appId, accessToken: stored.accessToken };
  try {
    const next = await refreshRabotaToken(stored.accessToken, creds);
    saveRabotaToken(next.accessToken, next.expiresIn);
    return { appId: creds.appId, accessToken: next.accessToken };
  } catch (e) {
    console.error("[hh-radar] rabota refresh", e instanceof Error ? e.message : e);
    if (stored.expiresAt.getTime() > Date.now()) return { appId: creds.appId, accessToken: stored.accessToken };
    return null;
  }
}

export function saveRabotaToken(accessToken: string, expiresIn: number) {
  const payload = {
    accessToken,
    expiresAt: new Date(Date.now() + Math.max(0, expiresIn) * 1000).toISOString(),
    savedAt: new Date().toISOString(),
  };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(payload), { mode: 0o600 });
}

export async function rabotaMe(accessToken: string, appId: string): Promise<string | null> {
  const response = await fetch("https://api.rabota.ru/v4/me.json", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Token": accessToken,
      "Application-Id": appId,
    },
    body: "{}",
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  if (!response.ok) return null;
  const id = text.match(/"id"\s*:\s*"?(\d+)"?/);
  return id?.[1] || null;
}
