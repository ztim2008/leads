// GET /api/admin/partner/setup?sourceId=xxx — вернуть команду для VPS
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";

const API_URL = process.env.NEXT_PUBLIC_URL || "https://leads.konversus.ru";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { email: (session.user as any).email } });
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sourceId = req.nextUrl.searchParams.get("sourceId");
  if (!sourceId) return NextResponse.json({ error: "sourceId required" }, { status: 400 });

  const source = await db.source.findUnique({ where: { id: sourceId } });
  if (!source) return NextResponse.json({ error: "source not found" }, { status: 404 });

  const cfg = source.config as any || {};

  return NextResponse.json({
    sourceId: source.id,
    login: cfg.login || "?",
    platform: source.platform,
    enabled: source.enabled,
    command: `curl -fsSL ${API_URL}/agent/v2/install.sh | bash -s "${source.id}"`,
    status: source.status || "pending",
    lastCheckAt: source.lastCheckAt,
    lastHeartbeat: cfg._lastHeartbeat || null,
  });
}
