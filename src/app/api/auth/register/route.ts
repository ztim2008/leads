import { NextResponse } from "next/server";

/** Публичная регистрация отключена — партнёры создаются только админом. */
export async function POST() {
  return NextResponse.json(
    { error: "Регистрация отключена. Обратитесь к администратору." },
    { status: 403 },
  );
}
