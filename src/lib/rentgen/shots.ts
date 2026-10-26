import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ViewKind } from "@/lib/rentgen/types";

const DIR = join(process.cwd(), "storage", "rentgen");

export function rentgenShotPath(scanId: string, view: ViewKind): string {
  mkdirSync(DIR, { recursive: true });
  return join(DIR, `${scanId.replace(/[^a-zA-Z0-9-]/g, "")}-${view}.jpg`);
}
