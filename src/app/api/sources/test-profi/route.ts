import { NextResponse } from "next/server";

/** Playwright Profi на хабе запрещён (profiOnHub: false). */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Тест входа Profi на хабе отключён. Сбор только через VPS-агент партнёра.",
    },
    { status: 403 },
  );
}
