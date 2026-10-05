import { db } from "@/lib/db";

export const RADAR_PROFILE_ID = "default";

export const DEFAULT_RADAR_PROFILE = {
  enabled: true,
  specialization: "Дизайнер карточек для маркетплейсов",
  about:
    "7 лет делаю карточки и инфографику для Wildberries, Ozon, Lamoda, Яндекс Маркета и Яндекс Кита. Figma и Photoshop. Нейросети для изображений, видео и аватаров: Midjourney, Runway, Kling. Визуальный маркетинг в e-commerce и основы A/B-тестов. 60–70 карточек в неделю за счёт шаблонов, библиотек и автоматизации. Точная цветопередача и характеристики товара. Ищу долгосрочную удалённую работу.",
  directions: ["Wildberries", "Ozon", "Lamoda", "Яндекс Маркет", "Яндекс Кит", "Инфографика", "Карточки товаров"],
  skills: ["Figma", "Photoshop", "Midjourney", "Runway", "Kling", "генерация изображений", "AI-видео", "AI-аватары"],
  formats: ["удалёнка", "долгосрочная работа"],
  exclusions: ["программирование", "frontend", "офис", "продажи"],
  searchQueries: ["дизайнер карточек", "дизайнер маркетплейсов", "инфографика Wildberries", "дизайнер Ozon"],
  salaryMin: 70000,
  requireSalary: true,
  remoteOnly: true,
  matchMin: 85,
  trustMin: 70,
  dailyAlertCap: 5,
  quietStart: "23:00",
  quietEnd: "08:00",
  alertsEnabled: true,
  telegramChatId: null as string | null,
};

export type RadarProfile = Awaited<ReturnType<typeof ensureRadarProfile>>;

export async function ensureRadarProfile() {
  const existing = await db.jobRadarProfile.findUnique({ where: { id: RADAR_PROFILE_ID } });
  if (existing) return existing;
  return db.jobRadarProfile.create({
    data: { id: RADAR_PROFILE_ID, ...DEFAULT_RADAR_PROFILE },
  });
}

export function linesToList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,]/)) {
    const item = part.trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.slice(0, 80));
  }
  return out.slice(0, 24);
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/\s/g, ""));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
