import { readFile } from "node:fs/promises";
import { scanIdBySlug } from "@/lib/rentgen/data";
import { rentgenShotPath } from "@/lib/rentgen/shots";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; view: string }> }) {
  const { slug, view } = await params;
  if (view !== "desktop" && view !== "mobile") return new Response("Not found", { status: 404 });
  const id = await scanIdBySlug(slug);
  if (!id) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(rentgenShotPath(id, view));
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
