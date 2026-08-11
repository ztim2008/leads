import { SignJWT, jwtVerify } from "jose";

export const AUTH_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "981enFOks++AvBhamoSqvoDPxzCIy8sVKuoZSTjHexQ=",
);

export const LEADS_TOKEN_COOKIE = "leads_token";

export interface LeadsTokenPayload {
  id: string;
  email: string;
  role: string;
  impersonatorId?: string;
  impersonatorEmail?: string;
}

export async function signLeadsToken(payload: LeadsTokenPayload, maxAgeSec = 86400): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${maxAgeSec}s`)
    .sign(AUTH_SECRET);
}

export async function verifyLeadsToken(token: string): Promise<LeadsTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, AUTH_SECRET);
    if (!payload.email || !payload.id) return null;
    return {
      id: String(payload.id),
      email: String(payload.email),
      role: String(payload.role || "user"),
      impersonatorId: payload.impersonatorId ? String(payload.impersonatorId) : undefined,
      impersonatorEmail: payload.impersonatorEmail ? String(payload.impersonatorEmail) : undefined,
    };
  } catch {
    return null;
  }
}

/** Эффективная роль для UI и API: при impersonation — партнёр. */
export function effectiveRole(p: LeadsTokenPayload): string {
  return p.role;
}

export function isImpersonating(p: LeadsTokenPayload): boolean {
  return !!p.impersonatorId;
}
