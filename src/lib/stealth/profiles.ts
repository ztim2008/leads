// Профили браузеров для анти-детекта
// Каждый профиль — уникальный отпечаток: User-Agent, viewport, платформа

export interface BrowserProfile {
  id: string;
  userAgent: string;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  platform: string;
  hasTouch: boolean;
  os: string;
  locale: string;
}

// Пул современных User-Agent + viewport (2025-2026)
export const BROWSER_PROFILES: BrowserProfile[] = [
  {
    id: "win-chrome-1",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    platform: "Win32", hasTouch: false, os: "Windows 10", locale: "ru-RU",
  },
  {
    id: "win-chrome-2",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    viewport: { width: 1536, height: 864 },
    deviceScaleFactor: 1,
    platform: "Win32", hasTouch: false, os: "Windows 10", locale: "ru-RU",
  },
  {
    id: "win-chrome-3",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    platform: "Win32", hasTouch: false, os: "Windows 10", locale: "ru-RU",
  },
  {
    id: "win-edge-1",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    platform: "Win32", hasTouch: false, os: "Windows 10", locale: "ru-RU",
  },
  {
    id: "win-edge-2",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    platform: "Win32", hasTouch: false, os: "Windows 10", locale: "ru-RU",
  },
  {
    id: "mac-chrome-1",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    platform: "MacIntel", hasTouch: false, os: "macOS 10.15", locale: "ru-RU",
  },
  {
    id: "mac-chrome-2",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    viewport: { width: 1728, height: 1117 },
    deviceScaleFactor: 2,
    platform: "MacIntel", hasTouch: false, os: "macOS 10.15", locale: "ru-RU",
  },
  {
    id: "mac-safari-1",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    platform: "MacIntel", hasTouch: false, os: "macOS 10.15", locale: "ru-RU",
  },
];

// Специальные «осторожные» профили
export const STEALTH_PROFILES: BrowserProfile[] = [
  {
    id: "stealth-win-chrome",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    platform: "Win32", hasTouch: false, os: "Windows 10", locale: "ru-RU",
  },
  {
    id: "stealth-win-edge",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
    viewport: { width: 1536, height: 864 },
    deviceScaleFactor: 1,
    platform: "Win32", hasTouch: false, os: "Windows 10", locale: "ru-RU",
  },
];

// Выбрать случайный профиль
export function pickRandomProfile(stealth = false): BrowserProfile {
  const pool = stealth ? [...BROWSER_PROFILES, ...STEALTH_PROFILES] : BROWSER_PROFILES;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Выбрать профиль, отличный от предыдущего
export function pickDifferentProfile(previousId?: string, stealth = false): BrowserProfile {
  const pool = stealth ? [...BROWSER_PROFILES, ...STEALTH_PROFILES] : BROWSER_PROFILES;
  const filtered = previousId ? pool.filter(p => p.id !== previousId) : pool;
  return filtered[Math.floor(Math.random() * filtered.length)];
}
