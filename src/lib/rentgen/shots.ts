import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ViewKind } from "@/lib/rentgen/types";

const DIR = join(process.cwd(), "storage", "rentgen");

const safeId = (scanId: string) => scanId.replace(/[^a-zA-Z0-9-]/g, "");

export function rentgenShotPath(scanId: string, view: ViewKind): string {
  mkdirSync(DIR, { recursive: true });
  return join(DIR, `${safeId(scanId)}-${view}.jpg`);
}

export function rentgenAttentionPath(scanId: string, view: ViewKind): string {
  mkdirSync(DIR, { recursive: true });
  return join(DIR, `${safeId(scanId)}-${view}-attn.png`);
}
