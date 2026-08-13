export type DoctorLevel = "ok" | "warn" | "call_agent";

export function isWithinWorkHours(start = "08:00", end = "22:00", now = Date.now()): boolean {
  const msk = new Date(now + 3 * 3600 * 1000);
  const mins = msk.getUTCHours() * 60 + msk.getUTCMinutes();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return mins >= sh * 60 + (sm || 0) && mins < eh * 60 + (em || 0);
}

export function worstLevel(levels: DoctorLevel[]): DoctorLevel {
  if (levels.includes("call_agent")) return "call_agent";
  if (levels.includes("warn")) return "warn";
  return "ok";
}
