"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin/guard";
import { db } from "@/lib/db";

export async function hideVacancy(formData: FormData) {
  const gate = await requireAdminUser();
  if (gate.error) return;
  const id = String(formData.get("id") || "");
  const reason = String(formData.get("reason") || "");
  if (!id) return;
  const hideReason = reason === "role" || reason === "pay" || reason === "seen" ? reason : null;
  await db.jobVacancy.update({ where: { id }, data: { status: "hidden", hideReason } }).catch(() => null);
  revalidatePath("/dashboard/radar", "layout");
}

export async function markApplied(formData: FormData) {
  const gate = await requireAdminUser();
  if (gate.error) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  await db.jobVacancy.update({ where: { id }, data: { status: "applied", hideReason: null } }).catch(() => null);
  revalidatePath("/dashboard/radar", "layout");
}

export async function restoreVacancy(formData: FormData) {
  const gate = await requireAdminUser();
  if (gate.error) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  await db.jobVacancy.update({ where: { id }, data: { status: "new", hideReason: null } }).catch(() => null);
  revalidatePath("/dashboard/radar", "layout");
}
