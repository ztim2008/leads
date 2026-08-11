import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import type { Prisma } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const user = await db.user.findUnique({ where: { email: (session.user as { email?: string }).email } });
  if (!user || user.role !== "admin") return null;
  return user;
}

/** PATCH — заметки онбординга: IP VPS, отметка «VPS готов». */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { sourceId, vpsIp, markVpsReady, notes } = body as {
    sourceId?: string;
    vpsIp?: string;
    markVpsReady?: boolean;
    notes?: string;
  };

  if (!sourceId) return NextResponse.json({ error: "sourceId required" }, { status: 400 });

  const source = await db.source.findUnique({ where: { id: sourceId } });
  if (!source) return NextResponse.json({ error: "source not found" }, { status: 404 });

  const cfg = { ...((source.config as Record<string, unknown>) || {}) };
  if (vpsIp !== undefined) cfg._vpsIp = vpsIp.trim() || null;
  if (markVpsReady !== undefined) cfg._onboardingVpsReady = markVpsReady;
  if (notes !== undefined) cfg._onboardingNotes = notes;

  await db.source.update({
    where: { id: sourceId },
    data: { config: cfg as Prisma.InputJsonValue },
  });

  return NextResponse.json({ ok: true, vpsIp: cfg._vpsIp, markVpsReady: cfg._onboardingVpsReady });
}
