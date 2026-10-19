import { NextResponse } from "next/server";
import { getAuditView } from "@/lib/diagnost/data";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const view = await getAuditView(slug);
  if (!view) return NextResponse.json({ error: "Аудит не найден" }, { status: 404 });
  return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
}
