export type RadarTap =
  | { type: "reply"; id: string }
  | { type: "applied"; id: string }
  | { type: "hide-menu"; id: string }
  | { type: "hide-back"; id: string }
  | { type: "hide"; id: string; reason: "role" | "pay" | "seen" };

const ID = "([0-9a-f-]{36})";

export function parseRadarTap(data: string): RadarTap | null {
  const reply = new RegExp(`^reply:${ID}$`, "i").exec(data);
  if (reply) return { type: "reply", id: reply[1] };
  const applied = new RegExp(`^applied:${ID}$`, "i").exec(data);
  if (applied) return { type: "applied", id: applied[1] };
  const menu = new RegExp(`^hide:${ID}$`, "i").exec(data);
  if (menu) return { type: "hide-menu", id: menu[1] };
  const back = new RegExp(`^hide:back:${ID}$`, "i").exec(data);
  if (back) return { type: "hide-back", id: back[1] };
  const hide = new RegExp(`^hide:(role|pay|seen):${ID}$`, "i").exec(data);
  if (hide) return { type: "hide", id: hide[2], reason: hide[1].toLowerCase() as "role" | "pay" | "seen" };
  return null;
}
