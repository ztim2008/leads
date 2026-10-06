export type RadarTrack = "cards" | "tilda" | "ai";

export const TRACK_LABEL: Record<RadarTrack, string> = {
  cards: "Карточки",
  tilda: "Тильда",
  ai: "ИИ",
};

/** Доли дневного лимита. Если поток пуст, слот забирает другой. */
export const TRACK_QUOTA: Record<RadarTrack, number> = {
  cards: 8,
  tilda: 4,
  ai: 4,
};

export const DEFAULT_TILDA_QUERIES = ["Tilda", "Тильда"];
export const DEFAULT_AI_QUERIES = ["AI-дизайнер", "AI-креатор", "ИИ-монтажёр", "AI видео"];

export function asTrack(value: string | null | undefined): RadarTrack {
  if (value === "tilda" || value === "ai" || value === "cards") return value;
  return "cards";
}

export function trackTerms(track: RadarTrack): string[] {
  if (track === "tilda") return ["Tilda", "Тильда", "сайт", "лендинг", "верстка"];
  if (track === "ai") return ["AI-дизайнер", "AI-креатор", "нейросети", "видео", "Midjourney"];
  return [];
}

export function allocatePushSlots<T extends { track: RadarTrack }>(
  pending: T[],
  room: number,
  already: Record<RadarTrack, number>,
): T[] {
  if (room <= 0) return [];
  const buckets: Record<RadarTrack, T[]> = { cards: [], tilda: [], ai: [] };
  for (const item of pending) buckets[item.track].push(item);

  const picked: T[] = [];
  let left = room;
  const order: RadarTrack[] = ["cards", "tilda", "ai"];
  for (const track of order) {
    const can = Math.max(0, TRACK_QUOTA[track] - already[track]);
    const take = Math.min(left, can, buckets[track].length);
    picked.push(...buckets[track].splice(0, take));
    left -= take;
  }
  const rest = order.flatMap((track) => buckets[track]);
  picked.push(...rest.slice(0, left));
  return picked;
}
