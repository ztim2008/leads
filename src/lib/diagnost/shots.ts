import { mkdirSync } from "node:fs";
import { join } from "node:path";

export type ShotKind = "desktop" | "mobile";

const DIR = join(process.cwd(), "storage", "diagnost");

export function shotPath(auditId: string, kind: ShotKind): string {
  mkdirSync(DIR, { recursive: true });
  return join(DIR, `${auditId.replace(/[^a-zA-Z0-9-]/g, "")}-${kind}.jpg`);
}
