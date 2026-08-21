/**
 * ProfiCollector — один координатор жизненного цикла сбора.
 *
 * Отличия от god-module src/lib/connectors/profi.ts:
 *   ❌ нет globalThis.__lastNewLead
 *   ❌ нет SILENT 30min → restart
 *   ❌ нет health-check → restart каждые 10 мин
 *   ❌ нет рекурсивного startWatching при SESSION EXPIRED
 *   ✅ CircuitBreaker: 3 fail → OPEN → ноль попыток входа
 *   ✅ Persistent profile (cookies + chromium userDataDir)
 *   ✅ Один restart path: только stop() + ручной/внешний start()
 *
 * Playwright — только на VPS. На хабе не вызывать (см. hub.ts).
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { CircuitBreaker } from "./circuit-breaker";
import { humanClick, humanScroll, humanType, sleep } from "./human";
import { ProfileStore } from "./profile-store";
import { pickDifferentProfile, randomCheckIntervalMs } from "./profiles";
import type {
  CollectorCallbacks,
  NormalizedLead,
  ProfiCollectorConfig,
} from "./types";

const LOGIN_URL = "https://profi.ru/backoffice/n.php";
const FEED_URL = "https://profi.ru/backoffice/n.php";

export class ProfiCollector {
  readonly config: ProfiCollectorConfig;
  readonly profiles: ProfileStore;
  readonly breaker: CircuitBreaker;

  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private knownHrefs = new Set<string>();
  private loginAttempts = 0;
  private callbacks: CollectorCallbacks | null = null;

  constructor(config: ProfiCollectorConfig, breaker?: CircuitBreaker) {
    this.config = config;
    this.profiles = new ProfileStore(config.sourceId, config.agentHome);
    this.breaker =
      breaker ??
      new CircuitBreaker({
        statePath: this.profiles.cbStatePath(),
        onStateChange: (prev, next, snap) => {
          this.callbacks?.onCircuitChange?.(snap);
          this.callbacks?.onStatus?.(
            `CB ${prev}→${next}` + (snap.openUntil ? ` until ${new Date(snap.openUntil).toISOString()}` : ""),
          );
        },
      });
  }

  getLoginAttemptCount(): number {
    return this.loginAttempts;
  }

  /** Один цикл: проверка CB → сессия → лента → leads. Без рестартов. */
  async runOnce(): Promise<NormalizedLead[]> {
    if (!this.breaker.canAttempt()) {
      const s = this.breaker.getState();
      this.callbacks?.onStatus?.(
        `CB ${s.state}: сбор пропущен` +
          (s.openUntil ? ` (до ${new Date(s.openUntil).toISOString()})` : ""),
      );
      return [];
    }

    const ok = await this.ensureSession();
    if (!ok) return [];

    try {
      const leads = await this.scanFeed();
      this.breaker.recordSuccess();
      return leads;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.callbacks?.onError?.(msg);
      // Session/page death — fail CB, do NOT auto-restart login storm
      if (/login|вход|сесси|expired|auth/i.test(msg)) {
        this.breaker.recordFailure(msg);
        await this.closeBrowser();
        this.profiles.clearSession();
      }
      return [];
    }
  }

  /** Цикл с одним планировщиком. stop() — единственный способ остановить. */
  async start(callbacks: CollectorCallbacks): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.callbacks = callbacks;
    callbacks.onStatus?.("collector started");

    const loop = async () => {
      if (!this.running) return;

      if (!this.breaker.canAttempt()) {
        const s = this.breaker.getState();
        const waitMs =
          s.state === "OPEN" && s.openUntil
            ? Math.max(5_000, s.openUntil - Date.now())
            : 60_000;
        callbacks.onStatus?.(`CB ${s.state}: тихий режим ${Math.round(waitMs / 60000)} мин`);
        this.timer = setTimeout(loop, Math.min(waitMs, 15 * 60_000));
        return;
      }

      if (this.isOutsideWorkHours()) {
        const waitMs = this.msUntilWakeUp();
        callbacks.onStatus?.(`вне рабочих часов, сон ~${Math.round(waitMs / 3600000)}ч`);
        this.timer = setTimeout(loop, Math.min(waitMs, 60 * 60_000));
        return;
      }

      const leads = await this.runOnce();
      for (const lead of leads) {
        await callbacks.onLead(lead);
      }

      // If CB opened during runOnce — next tick waits
      const minM = Math.max(2, this.config.pollMinMinutes ?? 3);
      const maxM = Math.max(minM, this.config.pollMaxMinutes ?? 7);
      const nextMs = this.breaker.canAttempt()
        ? randomCheckIntervalMs(minM, maxM)
        : Math.max(60_000, (this.breaker.getState().openUntil ?? Date.now() + 60_000) - Date.now());

      this.timer = setTimeout(loop, nextMs);
    };

    await loop();
  }

  /** Подтянуть интервал/часы с хаба без рестарта процесса. */
  updateRuntime(partial: Partial<ProfiCollectorConfig>): void {
    Object.assign(this.config, partial);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    void this.closeBrowser();
    this.callbacks?.onStatus?.("collector stopped");
  }

  // ─── Session ───────────────────────────────────────────────

  private async ensureSession(): Promise<boolean> {
    if (!this.breaker.canAttempt()) return false;

    if (this.page) {
      try {
        const body = await this.page.locator("body").innerText({ timeout: 10_000 });
        if (!body.includes("Вход и регистрация") && !body.includes("Восстановить пароль")) {
          return true;
        }
      } catch {
        /* dead page */
      }
      await this.closeBrowser();
    }

    return this.login();
  }

  private async login(): Promise<boolean> {
    if (!this.breaker.canAttempt()) {
      this.callbacks?.onStatus?.("CB blocks login");
      return false;
    }

    this.loginAttempts += 1;
    const stealth = this.config.antiDetect?.mode === "stealth";
    const prevId = this.profiles.getMeta().profileId || undefined;
    const profile =
      this.profiles.loadBrowserProfile() ?? pickDifferentProfile(prevId, stealth);

    try {
      this.browser = await chromium.launch({
        headless: this.config.headless !== false,
        timeout: 30_000,
      });

      const contextOptions: Parameters<Browser["newContext"]>[0] = {
        viewport: profile.viewport,
        userAgent: profile.userAgent,
        locale: profile.locale,
        timezoneId: "Europe/Moscow",
        deviceScaleFactor: profile.deviceScaleFactor,
        hasTouch: profile.hasTouch,
        storageState: undefined,
      };

      if (this.config.proxy) {
        contextOptions.proxy = { server: this.config.proxy };
      }

      // Prefer persistent cookies from disk
      const cookies = this.profiles.loadCookies();
      this.context = await this.browser.newContext(contextOptions);
      await this.context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => false });
      });

      if (cookies) {
        await this.context.addCookies(cookies as Parameters<BrowserContext["addCookies"]>[0]);
      }

      this.page = await this.context.newPage();
      await sleep(800 + Math.random() * 1200);
      await this.page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });

      // If cookies restored a session — skip form
      const body0 = await this.page.locator("body").innerText();
      if (!body0.includes("Вход и регистрация") && !body0.includes("Восстановить пароль")) {
        this.profiles.saveBrowserProfile(profile);
        this.profiles.setMeta({ lastLoginAt: Date.now(), profileId: profile.id });
        await this.persistSession();
        this.breaker.recordSuccess();
        this.callbacks?.onStatus?.("сессия восстановлена из профиля");
        return true;
      }

      await this.page.waitForSelector('[data-testid="auth_login_input"]', { timeout: 15_000 });
      await humanType(this.page, '[data-testid="auth_login_input"]', this.config.login);
      await sleep(300 + Math.random() * 500);
      await humanType(this.page, 'input[type="password"]', this.config.password);
      await sleep(400 + Math.random() * 600);
      await humanClick(this.page, '[data-testid="enter_with_sms_btn"]');
      await sleep(4000 + Math.random() * 4000);

      const body = await this.page.locator("body").innerText();
      if (
        body.includes("Некорректный логин") ||
        body.includes("Некорректный пароль") ||
        body.includes("Вход и регистрация") ||
        body.includes("Восстановить пароль")
      ) {
        throw new Error("login_failed: форма входа / неверный пароль / SMS / капча");
      }

      this.profiles.saveBrowserProfile(profile);
      this.profiles.setMeta({ lastLoginAt: Date.now(), profileId: profile.id });
      await this.persistSession();
      this.breaker.recordSuccess();
      this.callbacks?.onStatus?.("вход выполнен");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.breaker.recordFailure(msg);
      this.callbacks?.onError?.(msg);
      await this.closeBrowser();
      return false;
    }
  }

  private async persistSession(): Promise<void> {
    if (!this.context) return;
    try {
      const cookies = await this.context.cookies();
      this.profiles.saveCookies(cookies);
    } catch {
      /* ignore */
    }
  }

  private async closeBrowser(): Promise<void> {
    try {
      await this.context?.close();
    } catch {
      /* ignore */
    }
    try {
      await this.browser?.close();
    } catch {
      /* ignore */
    }
    this.page = null;
    this.context = null;
    this.browser = null;
  }

  // ─── Feed scan ─────────────────────────────────────────────

  private async scanFeed(): Promise<NormalizedLead[]> {
    if (!this.page) throw new Error("no page");

    await this.page.goto(FEED_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await sleep(1500 + Math.random() * 2000);

    const body = await this.page.locator("body").innerText();
    if (body.includes("Вход и регистрация") || body.includes("Восстановить пароль")) {
      throw new Error("session_expired: требуется вход");
    }

    // Human-ish scroll
    const scrolls = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < scrolls; i++) {
      await humanScroll(this.page, 200 + Math.random() * 400);
      await sleep(800 + Math.random() * 1500);
    }

    const links = await this.page.locator('a[href*="?o="]').evaluateAll((els) =>
      els.map((el) => ({
        href: (el as HTMLAnchorElement).href.replace(/&analytics_data=.*$/, ""),
        text: (el as HTMLElement).innerText?.trim() || "",
      })),
    );

    const leads: NormalizedLead[] = [];
    const kw = (this.config.keywords || "")
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    for (const link of links) {
      if (this.knownHrefs.has(link.href)) continue;
      this.knownHrefs.add(link.href);

      if (kw.length > 0) {
        const lower = link.text.toLowerCase();
        if (!kw.some((k) => lower.includes(k))) continue;
      }

      const lines = link.text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const title =
        lines.find(
          (l) =>
            l.length > 3 &&
            l !== "false" &&
            l !== "true" &&
            !/^\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/.test(
              l,
            ) &&
            !/^(Вчера|Сегодня|\d+\s+(час|минут|день|дня))/.test(l),
        ) || "Новый заказ";

      leads.push({
        externalId: link.href,
        title: title.slice(0, 150),
        description: link.text
          .replace(/\bfalse\b|\btrue\b/gi, "")
          .replace(/\n{2,}/g, "\n")
          .slice(0, 1000)
          .trim(),
        url: link.href,
        createdAt: new Date().toISOString(),
      });
    }

    await this.persistSession();
    this.callbacks?.onStatus?.(`проверка: ${leads.length} новых`);
    return leads;
  }

  // ─── Work hours (MSK) ──────────────────────────────────────

  private parseHour(s?: string, fallback = 8): number {
    if (!s) return fallback;
    const h = parseInt(s.split(":")[0] || "", 10);
    return Number.isFinite(h) ? h : fallback;
  }

  private mskHour(): number {
    return new Date(Date.now() + 3 * 60 * 60 * 1000).getUTCHours();
  }

  private isOutsideWorkHours(): boolean {
    const start = this.parseHour(this.config.workHoursStart, 8);
    const end = this.parseHour(this.config.workHoursEnd, 22);
    const h = this.mskHour();
    return h < start || h >= end;
  }

  private msUntilWakeUp(): number {
    const start = this.parseHour(this.config.workHoursStart, 8);
    const end = this.parseHour(this.config.workHoursEnd, 22);
    const h = this.mskHour();
    let hours: number;
    if (h >= end) hours = 24 - h + start;
    else if (h < start) hours = start - h;
    else hours = 1;
    return hours * 60 * 60 * 1000;
  }
}
