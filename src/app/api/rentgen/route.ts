import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/guard";
import { normalizeInputUrl } from "@/lib/diagnost/fetch";
import { createScan, LimitError, OWNER_COOKIE } from "@/lib/rentgen/data";

export async function POST(req: NextRequest) {
  let body: { url?: unknown };
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
  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = createHash("sha256").update(`rentgen:${ip}`).digest("hex");
  const owner = req.cookies.get(OWNER_COOKIE)?.value || randomUUID();
  const admin = await requireAdminUser().catch(() => ({ error: true }));

  try {
    const scan = await createScan({ url: url.toString(), host: url.hostname.replace(/^www\./, ""), owner, ipHash, unlimited: !admin.error });
    const response = NextResponse.json(scan);
    response.cookies.set(OWNER_COOKIE, owner, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365 });
    return response;
  } catch (error) {
    if (error instanceof LimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    console.error("[rentgen] create", error);
    return NextResponse.json({ error: "Не удалось начать проверку" }, { status: 500 });
  }
}
