const WORDSTAT_URL = "https://searchapi.api.cloud.yandex.net/v2/wordstat/topRequests";
const GPT_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";

const KNOWN_REGIONS: { needle: string; id: string; label: string }[] = [
  { needle: "подольск", id: "10747", label: "Подольск" },
  { needle: "казан", id: "43", label: "Казань" },
  { needle: "санкт-петербург", id: "2", label: "Санкт-Петербург" },
  { needle: "петербург", id: "2", label: "Санкт-Петербург" },
  { needle: "московская область", id: "1", label: "Москва и область" },
  { needle: "москва", id: "213", label: "Москва" },
  { needle: "росси", id: "225", label: "Россия" },
];

export type WordstatRegion = { id: string; label: string; exact: boolean };

export type WordstatPhrase = {
  phrase: string;
  count: number;
  intent: "price" | "order" | "geo" | "info" | "other";
};

let folderCache = "";

export function resolveRegion(regionName: string): WordstatRegion {
  const value = regionName.toLowerCase();
  for (const region of KNOWN_REGIONS) {
    if (value.includes(region.needle)) return { id: region.id, label: region.label, exact: true };
  }
  return { id: "225", label: "Россия", exact: false };
}

export function seedPhrases(niche: string, regionName: string): string[] {
  const clean = niche.toLowerCase().replace(/\s+/g, " ").trim();
  const core = clean.replace(/^производство\s+/, "").trim();
  const city = resolveRegion(regionName);
  const cityWord = city.exact && city.id !== "225" && city.id !== "1" ? city.label.toLowerCase() : "";
  const seeds = [core, clean];
  if (cityWord) seeds.push(`${core} ${cityWord}`);
  return [...new Set(seeds.filter((item) => item.length > 2))].slice(0, 3);
}

export function intentOf(phrase: string, cityLabel: string): WordstatPhrase["intent"] {
  const value = phrase.toLowerCase();
  if (/цена|стоимость|сколько стоит/.test(value)) return "price";
  if (/купить|заказать|пошив|опт|производ/.test(value)) return "order";
  if (cityLabel && cityLabel !== "Россия" && value.includes(cityLabel.toLowerCase())) return "geo";
  if (/как |что такое|своими/.test(value)) return "info";
  return "other";
}

export function phrasesFromTop(payload: unknown, cityLabel: string): WordstatPhrase[] {
  if (!payload || typeof payload !== "object") return [];
  const row = payload as { results?: unknown; associations?: unknown };
  const lists = [row.results, row.associations].flatMap((list) => (Array.isArray(list) ? list : []));
  const byPhrase = new Map<string, WordstatPhrase>();
  for (const item of lists) {
    if (!item || typeof item !== "object") continue;
    const phrase = String((item as { phrase?: unknown }).phrase || "").replace(/\s+/g, " ").trim();
    const count = Number((item as { count?: unknown }).count);
    if (!phrase || !Number.isFinite(count)) continue;
    const key = phrase.toLowerCase();
    const prev = byPhrase.get(key);
    if (!prev || count > prev.count) {
      byPhrase.set(key, { phrase, count, intent: intentOf(phrase, cityLabel) });
    }
  }
  return [...byPhrase.values()].sort((a, b) => b.count - a.count);
}

export function publicWordstatError(error: unknown): string {
  const text = error instanceof Error ? error.message : "Wordstat не ответил";
  return text.replace(/Api-Key\s+\S+/gi, "Api-Key").replace(/[A-Za-z0-9_\-]{24,}/g, "…").slice(0, 280);
}

async function discoverFolder(apiKey: string): Promise<string> {
  const response = await fetch(GPT_URL, {
    method: "POST",
    headers: {
      Authorization: `Api-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      modelUri: "gpt://test/yandexgpt/latest",
      completionOptions: { stream: false, temperature: 0, maxTokens: "10" },
      messages: [{ role: "user", text: "ping" }],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  const ids = [...text.matchAll(/folder ID '([a-z0-9]+)'/gi)]
    .map((match) => match[1])
    .filter((id) => id !== "test");
  const folder = ids[0] || text.match(/b1[a-z0-9]{18,}/i)?.[0];
  if (!folder || folder === "test") {
    throw new Error("Нужен идентификатор каталога Yandex Cloud в YANDEX_CLOUD_FOLDER_ID");
  }
  return folder;
}

export function cloudFolderId(value: string | undefined): string {
  const id = (value || "").trim();
  return /^b1[a-z0-9]{18}$/i.test(id) ? id : "";
}

/** Платный Wordstat выключен, пока в `.env` нет `BRIEFS_WORDSTAT=1`. */
export function wordstatEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BRIEFS_WORDSTAT === "1" && Boolean(env.YANDEX_SEARCH_API_KEY?.trim());
}

async function folderId(apiKey: string): Promise<string> {
  const fromEnv = cloudFolderId(process.env.YANDEX_CLOUD_FOLDER_ID);
  if (fromEnv) return fromEnv;
  if (folderCache) return folderCache;
  folderCache = await discoverFolder(apiKey);
  return folderCache;
}

async function topRequests(apiKey: string, folder: string, phrase: string, regionId: string): Promise<unknown> {
  const response = await fetch(WORDSTAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Api-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phrase,
      numPhrases: 20,
      regions: [regionId],
      folderId: folder,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Wordstat ${response.status}: ${text.slice(0, 240)}`);
  return JSON.parse(text) as unknown;
}

export async function collectWordstat(input: {
  niche: string;
  regionName: string;
}): Promise<{ region: WordstatRegion; phrases: WordstatPhrase[] } | null> {
  const apiKey = process.env.YANDEX_SEARCH_API_KEY?.trim();
  if (!wordstatEnabled() || !apiKey) return null;
  const region = resolveRegion(input.regionName);
  const folder = await folderId(apiKey);
  const merged = new Map<string, WordstatPhrase>();
  for (const phrase of seedPhrases(input.niche, input.regionName)) {
    const payload = await topRequests(apiKey, folder, phrase, region.id);
    for (const row of phrasesFromTop(payload, region.label)) {
      const key = row.phrase.toLowerCase();
      const prev = merged.get(key);
      if (!prev || row.count > prev.count) merged.set(key, row);
    }
  }
  return {
    region,
    phrases: [...merged.values()].sort((a, b) => b.count - a.count).slice(0, 20),
  };
}
