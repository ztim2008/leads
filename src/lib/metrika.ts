export const YM_ID = 113690601;

type Ym = (id: number, action: string, ...args: unknown[]) => void;

export function reachGoal(goal: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const ym = (window as unknown as { ym?: Ym }).ym;
  if (typeof ym === "function") ym(YM_ID, "reachGoal", goal, params);
}
