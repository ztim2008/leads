import { db } from "@/lib/db";
import { DEFAULT_AI_QUERIES, DEFAULT_TILDA_QUERIES, DEFAULT_WEB_QUERIES } from "./tracks";

export const RADAR_PROFILE_ID = "default";

export const DEFAULT_RADAR_PROFILE = {
  enabled: true,
  specialization: "Дизайнер маркетплейсов, веб и AI",
  about:
    "7 лет делаю карточки и инфографику для Wildberries, Ozon, Avito, Lamoda, Яндекс Маркета и Яндекс Кита. Figma, Photoshop, CorelDRAW, Illustrator. Нейросети для изображений: Midjourney, Runway, Kling. Делаю и веду сайты, лендинги и веб-приложения, настраиваю рекламу и продвижение, разрабатываю AI-агентов и автоматизацию. Ищу долгосрочную удалённую работу по всей России. Портфолио: https://konversus.ru/portfolio/timeline",
  directions: ["Wildberries", "Ozon", "Avito", "Lamoda", "Яндекс Маркет", "Яндекс Кит", "Инфографика", "Карточки товаров"],
  skills: ["Figma", "Photoshop", "CorelDRAW", "Illustrator", "Midjourney", "Runway", "Kling", "генерация изображений"],
  formats: ["удалёнка", "по всей России", "долгосрочная работа"],
  exclusions: ["офис", "продажи"],
  searchQueries: [
    "дизайнер карточек",
    "инфографика",
    "графический дизайнер маркетплейс",
    "дизайнер маркетплейсов",
    "дизайнер wildberries",
    "дизайнер ozon",
  ],
  tildaQueries: DEFAULT_TILDA_QUERIES,
  aiQueries: DEFAULT_AI_QUERIES,
  webQueries: DEFAULT_WEB_QUERIES,
  salaryMin: 50000,
  requireSalary: false,
  remoteOnly: true,
  matchMin: 85,
  trustMin: 70,
  dailyAlertCap: 15,
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
