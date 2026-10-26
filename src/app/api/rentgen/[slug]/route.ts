import { NextResponse } from "next/server";
import { getScanView } from "@/lib/rentgen/data";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const view = await getScanView(slug);
  if (!view) return NextResponse.json({ error: "Проверка не найдена" }, { status: 404 });
  return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
}
