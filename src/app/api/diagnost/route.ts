import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/guard";
import { CLOSED_MESSAGE } from "@/lib/diagnost/access";
import { createAudit, LimitError, OWNER_COOKIE } from "@/lib/diagnost/data";
import { normalizeInputUrl } from "@/lib/diagnost/fetch";
import type { BusinessType } from "@/lib/diagnost/types";

const TYPES: BusinessType[] = ["ecommerce", "services", "b2b", "saas", "local", "info", "other"];

export async function POST(req: NextRequest) {
  const admin = await requireAdminUser();
  if (admin.error) return NextResponse.json({ error: CLOSED_MESSAGE, closed: true }, { status: 403 });

  let body: { url?: unknown; businessType?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Пустой запрос" }, { status: 400 });
  }
  let url: URL;
  try {
    url = normalizeInputUrl(typeof body.url === "string" ? body.url : "");
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Неверный адрес" }, { status: 400 });
  }
  const hint = TYPES.includes(body.businessType as BusinessType) ? (body.businessType as BusinessType) : null;
  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = createHash("sha256").update(`diagnost:${ip}`).digest("hex");
  const owner = req.cookies.get(OWNER_COOKIE)?.value || randomUUID();

  try {
    const audit = await createAudit({ url: url.toString(), host: url.hostname.replace(/^www\./, ""), hint, owner, ipHash, unlimited: true });
    const response = NextResponse.json({ slug: audit.slug });
    response.cookies.set(OWNER_COOKIE, owner, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365 });
    return response;
  } catch (error) {
    if (error instanceof LimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    console.error("[diagnost] create", error);
    return NextResponse.json({ error: "Не удалось создать аудит" }, { status: 500 });
  }
}
