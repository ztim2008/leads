import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "job-radar";
}

export function signVacancyHide(id: string): string {
  return createHmac("sha256", secret()).update(`hide:${id}`).digest("hex").slice(0, 24);
}

export function verifyVacancyHide(id: string, sig: string): boolean {
  const expected = signVacancyHide(id);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://leads.konversus.ru").replace(/\/$/, "");
}
