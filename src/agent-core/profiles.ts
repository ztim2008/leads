/**
 * Browser fingerprint profiles — copied from src/lib/stealth/profiles.ts
 * for agent-core reuse on VPS without hub imports.
 */

import type { BrowserProfile } from "./types";

export type { BrowserProfile };

export const BROWSER_PROFILES: BrowserProfile[] = [
  {
    id: "win-chrome-1",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    platform: "Win32",
    hasTouch: false,
    os: "Windows 10",
    locale: "ru-RU",
  },
  {
    id: "win-chrome-2",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    viewport: { width: 1536, height: 864 },
    deviceScaleFactor: 1,
    platform: "Win32",
    hasTouch: false,
    os: "Windows 10",
    locale: "ru-RU",
  },
  {
    id: "win-chrome-3",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    platform: "Win32",
    hasTouch: false,
    os: "Windows 10",
    locale: "ru-RU",
  },
  {
    id: "win-edge-1",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    platform: "Win32",
    hasTouch: false,
    os: "Windows 10",
    locale: "ru-RU",
  },
  {
    id: "mac-chrome-1",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    platform: "MacIntel",
    hasTouch: false,
    os: "macOS 10.15",
    locale: "ru-RU",
  },
  {
    id: "mac-chrome-2",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    viewport: { width: 1728, height: 1117 },
    deviceScaleFactor: 2,
    platform: "MacIntel",
    hasTouch: false,
    os: "macOS 10.15",
    locale: "ru-RU",
  },
];

export const STEALTH_PROFILES: BrowserProfile[] = [
  {
    id: "stealth-win-chrome",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    platform: "Win32",
    hasTouch: false,
    os: "Windows 10",
    locale: "ru-RU",
  },
];

export function pickRandomProfile(stealth = false): BrowserProfile {
  const pool = stealth ? [...BROWSER_PROFILES, ...STEALTH_PROFILES] : BROWSER_PROFILES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickDifferentProfile(previousId?: string, stealth = false): BrowserProfile {
  const pool = stealth ? [...BROWSER_PROFILES, ...STEALTH_PROFILES] : BROWSER_PROFILES;
  const filtered = previousId ? pool.filter((p) => p.id !== previousId) : pool;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

/** Random delay helpers for collector loop (no Playwright). */
export function randomCheckIntervalMs(minMin = 3, maxMin = 7): number {
  const minutes = minMin + Math.random() * (maxMin - minMin);
  return minutes * 60 * 1000 * (0.85 + Math.random() * 0.3);
}

export function sleep(ms: number): Promise<void> {
  const actual = ms * (0.85 + Math.random() * 0.3);
  return new Promise((resolve) => setTimeout(resolve, actual));
}
