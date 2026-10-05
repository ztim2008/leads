import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/guard";
import { runRadarCycle } from "@/lib/radar/cycle";

export async function POST() {
  const gate = await requireAdminUser();
  if (gate.error) return gate.error;
  const result = await runRadarCycle();
  return NextResponse.json(result);
}
