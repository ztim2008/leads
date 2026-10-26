import { readFile } from "node:fs/promises";
import { scanIdBySlug } from "@/lib/rentgen/data";
import { rentgenAttentionPath, rentgenShotPath } from "@/lib/rentgen/shots";
import type { ViewKind } from "@/lib/rentgen/types";

const FILES: Record<string, { kind: ViewKind; attention: boolean }> = {
  desktop: { kind: "desktop", attention: false },
  mobile: { kind: "mobile", attention: false },
  "desktop-attn": { kind: "desktop", attention: true },
  "mobile-attn": { kind: "mobile", attention: true },
};

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; view: string }> }) {
  const { slug, view } = await params;
  const file = Object.hasOwn(FILES, view) ? FILES[view] : null;
  if (!file) return new Response("Not found", { status: 404 });
  const id = await scanIdBySlug(slug);
  if (!id) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(file.attention ? rentgenAttentionPath(id, file.kind) : rentgenShotPath(id, file.kind));
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": file.attention ? "image/png" : "image/jpeg", "Cache-Control": "public, max-age=86400, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
