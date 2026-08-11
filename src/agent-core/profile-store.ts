/**
 * Persistent browser profile store — cookies + localStorage + chromium userDataDir.
 * Path: ~/.leads-agent/profiles/{sourceId}/
 */

import fs from "node:fs";
import path from "node:path";
import type { BrowserProfile, ProfileMeta } from "./types";
import { defaultAgentHome, ensureDir, profileDir, readJsonFile, writeJsonFile } from "./paths";

export interface StoredCookies {
  cookies: unknown[];
  savedAt: number;
}

export interface StoredLocalStorage {
  entries: Record<string, string>;
  origin?: string;
  savedAt: number;
}

export class ProfileStore {
  readonly sourceId: string;
  readonly root: string;

  constructor(sourceId: string, agentHome?: string) {
    this.sourceId = sourceId;
    this.root = profileDir(defaultAgentHome(agentHome), sourceId);
    ensureDir(this.root);
    ensureDir(this.chromiumDir());
  }

  chromiumDir(): string {
    return path.join(this.root, "chromium");
  }

  cookiesPath(): string {
    return path.join(this.root, "cookies.json");
  }

  localStoragePath(): string {
    return path.join(this.root, "localStorage.json");
  }

  metaPath(): string {
    return path.join(this.root, "meta.json");
  }

  cbStatePath(): string {
    return path.join(this.root, "state.json");
  }

  getMeta(): ProfileMeta {
    return readJsonFile<ProfileMeta>(this.metaPath(), {
      sourceId: this.sourceId,
      profileId: "",
      lastLoginAt: null,
      cookiesSavedAt: null,
    });
  }

  setMeta(patch: Partial<ProfileMeta>): ProfileMeta {
    const next = { ...this.getMeta(), ...patch, sourceId: this.sourceId };
    writeJsonFile(this.metaPath(), next);
    return next;
  }

  saveCookies(cookies: unknown[]): void {
    const savedAt = Date.now();
    writeJsonFile(this.cookiesPath(), { cookies, savedAt } satisfies StoredCookies);
    this.setMeta({ cookiesSavedAt: savedAt });
  }

  loadCookies(): unknown[] | null {
    const data = readJsonFile<StoredCookies | null>(this.cookiesPath(), null);
    if (!data || !Array.isArray(data.cookies) || data.cookies.length === 0) return null;
    return data.cookies;
  }

  saveLocalStorage(entries: Record<string, string>, origin = "https://profi.ru"): void {
    writeJsonFile(this.localStoragePath(), {
      entries,
      origin,
      savedAt: Date.now(),
    } satisfies StoredLocalStorage);
  }

  loadLocalStorage(): StoredLocalStorage | null {
    const data = readJsonFile<StoredLocalStorage | null>(this.localStoragePath(), null);
    if (!data || !data.entries || Object.keys(data.entries).length === 0) return null;
    return data;
  }

  /** Есть ли сохранённые куки для повторного использования сессии. */
  hasSession(): boolean {
    return this.loadCookies() != null;
  }

  clearSession(): void {
    for (const p of [this.cookiesPath(), this.localStoragePath()]) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
    this.setMeta({ lastLoginAt: null, cookiesSavedAt: null });
  }

  saveBrowserProfile(profile: BrowserProfile): void {
    this.setMeta({ profileId: profile.id });
    writeJsonFile(path.join(this.root, "browser-profile.json"), profile);
  }

  loadBrowserProfile(): BrowserProfile | null {
    return readJsonFile<BrowserProfile | null>(path.join(this.root, "browser-profile.json"), null);
  }
}
