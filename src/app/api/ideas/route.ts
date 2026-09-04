import { NextResponse } from "next/server";
import { requireIdeasUser } from "@/lib/ideas/guard";

/** GET /api/ideas — stub MVP step 1 (пустой список / 403 без доступа) */
export async function GET() {
  const gate = await requireIdeasUser();
  if (gate.error) return gate.error;

  return NextResponse.json({
    ideas: [],
    note: "CRUD идей — следующий шаг MVP",
  });
}
