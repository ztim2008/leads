import { NextResponse } from "next/server";

export const AGENT_SECRET = process.env.AGENT_SECRET || "leads-agent-secret-2026";

export function verifyAgentSecret(secret: string | null | undefined): boolean {
  return secret === AGENT_SECRET;
}

export function agentUnauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
