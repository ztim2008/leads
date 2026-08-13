import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/guard";
import { diagnose, healSafe } from "@/lib/admin/doctor";

export async function GET() {
  const guard = await requireAdminUser();
  if (guard.error) return guard.error;
  const report = await diagnose();
  return NextResponse.json(report);
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminUser();
  if (guard.error) return guard.error;
  const body = await req.json().catch(() => ({}));
  const action = body.action || "heal";

  if (action === "restart-profi" || action === "restart-agent" || action === "reset-cb") {
    return NextResponse.json(
      { error: "Запрещено: доктор не рестартит Profi/VPS и не сбрасывает CB сам." },
      { status: 400 },
    );
  }

  if (action !== "heal") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  const before = await diagnose();
  const result = await healSafe(before);
  const after = await diagnose();
  return NextResponse.json({ ok: true, healed: result.healed, before: before.level, after });
}
