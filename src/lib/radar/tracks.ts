export type RadarTrack = "cards" | "tilda" | "ai" | "web";

export const RADAR_TRACKS: RadarTrack[] = ["cards", "tilda", "ai", "web"];

export const TRACK_LABEL: Record<RadarTrack, string> = {
  cards: "Карточки",
  tilda: "Тильда",
  ai: "ИИ",
  web: "Технологии",
};

/** Доли дневного лимита 15. Если поток пуст, слот забирает другой. */
export const TRACK_QUOTA: Record<RadarTrack, number> = {
  cards: 5,
  web: 6,
  tilda: 2,
  ai: 2,
};

export const DEFAULT_TILDA_QUERIES = ["Tilda", "Тильда"];
export const DEFAULT_AI_QUERIES = ["AI-дизайнер", "AI-креатор"];
export const DEFAULT_WEB_QUERIES = [
  "веб-разработчик",
  "разработчик сайтов",
  "создание сайтов",
  "поддержка сайтов",
  "веб-дизайнер",
  "frontend разработчик",
  "веб-мастер",
  "системный администратор",
  "сисадмин",
  "devops",
  "AI-разработчик",
  "AI engineer",
  "инженер ИИ",
  "специалист по нейросетям",
];

export function isRadarTrack(value: string | null | undefined): value is RadarTrack {
  return value === "cards" || value === "tilda" || value === "ai" || value === "web";
}

export function asTrack(value: string | null | undefined): RadarTrack {
  return isRadarTrack(value) ? value : "cards";
}

export function trackTerms(track: RadarTrack): string[] {
  if (track === "tilda") return ["Tilda", "Тильда", "сайт", "лендинг", "верстка"];
  if (track === "ai") return ["AI-дизайнер", "AI-креатор", "нейросети", "Midjourney"];
  if (track === "web") return ["сайт", "лендинг", "веб-приложение", "AI-агент", "нейросети", "системный администратор"];
  return [];
}

export function allocatePushSlots<T extends { track: RadarTrack }>(
  pending: T[],
  room: number,
  already: Record<RadarTrack, number>,
): T[] {
  if (room <= 0) return [];
  const buckets: Record<RadarTrack, T[]> = { cards: [], tilda: [], ai: [], web: [] };
  for (const item of pending) buckets[item.track].push(item);

  const picked: T[] = [];
  let left = room;
  const order: RadarTrack[] = ["cards", "web", "tilda", "ai"];
  for (const track of order) {
    const can = Math.max(0, TRACK_QUOTA[track] - (already[track] ?? 0));
    const take = Math.min(left, can, buckets[track].length);
    picked.push(...buckets[track].splice(0, take));
    left -= take;
  }
  const rest = order.flatMap((track) => buckets[track]);
  picked.push(...rest.slice(0, left));
  return picked;
}
