import { readFile } from "node:fs/promises";
import { auditIdBySlug } from "@/lib/diagnost/data";
import { shotPath, type ShotKind } from "@/lib/diagnost/shots";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await params;
  if (kind !== "desktop" && kind !== "mobile") return new Response("Not found", { status: 404 });
  const id = await auditIdBySlug(slug);
  if (!id) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(shotPath(id, kind as ShotKind));
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
