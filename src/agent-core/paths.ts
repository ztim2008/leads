/**
 * Persistent JSON store for agent-core.
 * Default root: ~/.leads-agent
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function defaultAgentHome(override?: string): string {
  if (override) return override;
  if (process.env.LEADS_AGENT_HOME) return process.env.LEADS_AGENT_HOME;
  return path.join(os.homedir(), ".leads-agent");
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}

export function profileDir(agentHome: string, sourceId: string): string {
  return path.join(agentHome, "profiles", sourceId);
}

export function globalStatePath(agentHome: string): string {
  return path.join(agentHome, "state.json");
}
