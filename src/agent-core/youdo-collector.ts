/**
 * YouDoCollector — анонимный сбор открытых заданий YouDo (без входа в аккаунт).
 *
 *   ✅ Аккаунт партнёра не используется: ни логина, ни cookies пользователя
 *   ✅ Лента через внутренний /api/tasks/tasks/ из контекста страницы (после прохождения ServicePipe)
 *   ✅ CircuitBreaker: капча / 403 / не-JSON → тихий режим, без штурма
 *   ✅ Первый запуск: текущая лента помечается просмотренной, в Telegram не льём
 *
 * Playwright — только на VPS партнёра. На хабе не запускать.
 */

import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { CircuitBreaker } from "./circuit-breaker";
import { sleep } from "./human";
import { defaultAgentHome, readJsonFile, writeJsonFile } from "./paths";
import type { CircuitBreakerSnapshot, CollectorCallbacks, NormalizedLead } from "./types";

const ORIGIN = "https://youdo.com";
const BLOCKED_HOSTS = /api-maps\.yandex|maps\.yandex|front-maps|core-renderer-tiles|mc\.yandex|yandex\.ru\/adfox|adfox|sentry\.youdo|traces\.youdo|googletagmanager|google-analytics|vk\.com\/rtrg|top-fwz1|facebook/i;
const SEEN_MAX = 3000;
const PAGE_REFRESH_MS = 45 * 60_000;
const MIN_POLL_SEC = 45;
const DEFAULT_POLL_STEPS_SEC = [60, 180, 360];
const POLL_JITTER = 0.2;

export interface YouDoCollectorConfig {
  sourceId: string;
  categories?: string[];
  onlyVirtual?: boolean;
  workHoursStart?: string;
  workHoursEnd?: string;
  /** Ступени паузы между опросами, выбирается случайно, ±20%. По умолчанию 1/3/6 мин. */
  pollStepsSec?: number[];
  agentHome?: string;
  headless?: boolean;
}

export interface YouDoLead extends NormalizedLead {
  responses?: number;
  remote?: boolean;
  reviewCount?: number;
}

interface FeedItem {
  Id: number;
  Name: string;
  Url?: string;
  BudgetDescription?: string;
  PriceAmount?: number;
  Address?: string | null;
  OffersCount?: number;
  CategoryFlag?: string;
  IsSbr?: boolean;
  IsB2B?: boolean;
  CreatorInfo?: { UserName?: string; Rating?: { SummaryReviews?: number } };
}

interface SeenState {
  ids: number[];
  seededAt: number | null;
}

type FeedResult = { ok: true; items: FeedItem[] } | { ok: false; reason: string };

export function parseYouDoBudget(desc?: string, amount?: number): number | undefined {
  if (amount && amount > 0) return amount;
  const m = String(desc || "").replace(/\u00a0/g, " ").match(/(\d[\d\s]*)/);
  if (!m) return undefined;
  const v = parseInt(m[1].replace(/\s/g, ""), 10);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

export function pickPollDelayMs(stepsSec?: number[], rnd: () => number = Math.random): number {
  const steps = (stepsSec || []).filter((n) => Number.isFinite(n) && n > 0);
  const pool = steps.length ? steps : DEFAULT_POLL_STEPS_SEC;
  const base = pool[Math.floor(rnd() * pool.length)] ?? pool[0];
  const jittered = base * (1 - POLL_JITTER + rnd() * 2 * POLL_JITTER);
  return Math.round(Math.max(MIN_POLL_SEC, jittered) * 1000);
}

function mskHour(now = Date.now()): number {
  return new Date(now + 3 * 3600_000).getUTCHours();
}

function hourOf(s: string | undefined, fallback: number): number {
  const h = parseInt(String(s || "").split(":")[0] || "", 10);
  return Number.isFinite(h) ? h : fallback;
}

export class YouDoCollector {
  readonly config: YouDoCollectorConfig;
  readonly breaker: CircuitBreaker;

  private readonly statePath: string;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private pageOpenedAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private seen: SeenState;
  private callbacks: CollectorCallbacks | null = null;
  private lastFeedOkAt: number | null = null;

  constructor(config: YouDoCollectorConfig) {
    this.config = config;
    const home = path.join(defaultAgentHome(config.agentHome), "youdo", config.sourceId);
    this.statePath = path.join(home, "seen.json");
    this.seen = readJsonFile<SeenState>(this.statePath, { ids: [], seededAt: null });
    this.breaker = new CircuitBreaker({
      statePath: path.join(home, "circuit-breaker.json"),
      onStateChange: (prev, next, snap) => {
        this.callbacks?.onCircuitChange?.(snap);
        this.callbacks?.onStatus?.(
          `CB ${prev}→${next}` + (snap.openUntil ? ` until ${new Date(snap.openUntil).toISOString()}` : ""),
        );
      },
    });
  }

  updateRuntime(patch: Partial<YouDoCollectorConfig>): void {
    Object.assign(this.config, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
  }

  getBreakerState(): CircuitBreakerSnapshot {
    return this.breaker.getState();
  }

  getLastFeedOkAt(): string | null {
    return this.lastFeedOkAt ? new Date(this.lastFeedOkAt).toISOString() : null;
  }

  async start(callbacks: CollectorCallbacks): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.callbacks = callbacks;
    callbacks.onStatus?.("youdo collector started");

    const loop = async () => {
      if (!this.running) return;

      if (!this.breaker.canAttempt()) {
        const s = this.breaker.getState();
        const waitMs =
          s.state === "OPEN" && s.openUntil ? Math.max(5_000, s.openUntil - Date.now()) : 60_000;
        callbacks.onStatus?.(`CB ${s.state}: тихий режим ${Math.round(waitMs / 60000)} мин`);
        this.timer = setTimeout(loop, Math.min(waitMs, 15 * 60_000));
        return;
      }

      if (this.isOutsideWorkHours()) {
        await this.closeBrowser();
        callbacks.onStatus?.("вне рабочих часов, пауза 15 мин");
        this.timer = setTimeout(loop, 15 * 60_000);
        return;
      }

      try {
        await this.runOnce();
      } catch (err) {
        callbacks.onError?.(err instanceof Error ? err.message : String(err));
      }
      const delay = this.nextDelayMs();
      callbacks.onStatus?.(`следующая проверка через ${Math.round(delay / 1000)} с`);
      this.timer = setTimeout(loop, delay);
    };

    await loop();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.closeBrowser();
  }

  async runOnce(): Promise<void> {
    let feed = await this.fetchFeed();
    if (!feed.ok) {
      this.callbacks?.onStatus?.(`сбой ленты (${feed.reason}), переоткрываю страницу`);
      await this.closeBrowser();
      await sleep(5_000 + Math.random() * 5_000);
      feed = await this.fetchFeed();
    }
    if (!feed.ok) {
      this.breaker.recordFailure(feed.reason);
      this.callbacks?.onError?.(`youdo feed: ${feed.reason}`);
      await this.closeBrowser();
      return;
    }
    this.breaker.recordSuccess();
    this.lastFeedOkAt = Date.now();

    const known = new Set(this.seen.ids);
    const fresh = feed.items.filter((it) => it && typeof it.Id === "number" && !known.has(it.Id));

    if (!this.seen.seededAt) {
      this.remember(feed.items.map((it) => it.Id));
      this.seen.seededAt = Date.now();
      this.saveSeen();
      this.callbacks?.onStatus?.(`первый запуск: ${feed.items.length} заданий помечены просмотренными`);
      return;
    }

    this.callbacks?.onStatus?.(`проверка: ${feed.items.length} в ленте, новых ${fresh.length}`);
    if (!fresh.length) return;

    fresh.sort((a, b) => a.Id - b.Id);
    for (const item of fresh) {
      if (!this.running) break;
      const description = await this.fetchDescription(item.Id).catch(() => "");
      this.remember([item.Id]);
      this.saveSeen();
      await this.callbacks?.onLead(this.toLead(item, description));
      await sleep(800 + Math.random() * 1500);
    }
  }

  private toLead(item: FeedItem, description: string): YouDoLead {
    const budget = parseYouDoBudget(item.BudgetDescription, item.PriceAmount);
    const reviews = item.CreatorInfo?.Rating?.SummaryReviews;
    return {
      externalId: `youdo-${item.Id}`,
      title: String(item.Name || "").slice(0, 150),
      description: (description || item.Name || "").slice(0, 3000),
      url: `${ORIGIN}/t${item.Id}`,
      createdAt: new Date().toISOString(),
      author: item.CreatorInfo?.UserName || undefined,
      budgetMax: budget,
      responses: typeof item.OffersCount === "number" ? item.OffersCount : undefined,
      remote: !item.Address,
      reviewCount: typeof reviews === "number" ? reviews : undefined,
    };
  }

  private async fetchFeed(): Promise<FeedResult> {
    const page = await this.ensurePage();
    if (!page) return { ok: false, reason: "page_unavailable" };

    const body = {
      q: "",
      list: "all",
      status: "opened",
      radius: null,
      lat: null,
      lng: null,
      page: 1,
      noOffers: false,
      onlySbr: false,
      onlyB2B: false,
      onlyVacancies: false,
      priceMin: "",
      sortType: 1,
      onlyVirtual: this.config.onlyVirtual !== false,
      categories: this.config.categories?.length ? this.config.categories : ["all"],
    };

    const res = await page
      .evaluate(async (payload) => {
        try {
          const r = await fetch("/api/tasks/tasks/", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(payload),
            credentials: "include",
          });
          const ct = r.headers.get("content-type") || "";
          if (!ct.includes("json")) return { status: r.status, json: null };
          return { status: r.status, json: await r.json() };
        } catch (e) {
          return { status: 0, json: null, error: String(e) };
        }
      }, body)
      .catch((e: unknown) => ({ status: 0, json: null, error: String(e) }));

    const json = res.json as { IsSuccess?: boolean; ResultObject?: { Items?: FeedItem[] } } | null;
    if (!json) {
      const detail = "error" in res && res.error ? `: ${String(res.error).slice(0, 120)}` : "";
      return { ok: false, reason: `http_${res.status || "err"}_not_json${detail}` };
    }
    if (json.IsSuccess === false) return { ok: false, reason: "api_not_success" };
    return { ok: true, items: json.ResultObject?.Items || [] };
  }

  private async fetchDescription(taskId: number): Promise<string> {
    const page = this.page;
    if (!page) return "";
    const text = await page.evaluate(async (id) => {
      const r = await fetch(`/t${id}`, { credentials: "include" });
      if (!r.ok) return "";
      const html = await r.text();
      const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (!m) return "";
      try {
        const data = JSON.parse(m[1]);
        return String(data?.props?.initialState?.taskState?.taskInfo?.description || "");
      } catch {
        return "";
      }
    }, taskId);
    return text.trim();
  }

  private async ensurePage(): Promise<Page | null> {
    if (this.page && Date.now() - this.pageOpenedAt < PAGE_REFRESH_MS) return this.page;
    await this.closeBrowser();

    const launchOpts = {
      headless: this.config.headless !== false,
      args: ["--disable-blink-features=AutomationControlled", "--disable-dev-shm-usage", "--disable-gpu"],
    };
    // chrome-headless-shell на VPS пилота падает (trap int3) — полный Chromium в new headless стабильнее
    this.browser = await chromium
      .launch({ ...launchOpts, channel: "chromium" })
      .catch(() => chromium.launch(launchOpts));
    this.context = await this.browser.newContext({
      viewport: { width: 1366, height: 800 },
      locale: "ru-RU",
      timezoneId: "Europe/Moscow",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    });
    await this.context.route("**/*", (route) => {
      const req = route.request();
      const type = req.resourceType();
      if (BLOCKED_HOSTS.test(req.url()) || type === "image" || type === "media" || type === "font") {
        return route.abort();
      }
      return route.continue();
    });

    const browser = this.browser;
    browser.on("disconnected", () => {
      if (this.browser !== browser || !this.page) return;
      this.callbacks?.onStatus?.("браузер упал, откроется заново на следующей проверке");
      this.page = null;
      this.context = null;
      this.browser = null;
    });
    const page = await this.context.newPage();
    page.on("crash", () => this.callbacks?.onStatus?.("диагностика: страница упала (crash)"));
    page.on("close", () => {
      if (this.page !== page) return;
      this.callbacks?.onStatus?.(`страница закрыта извне (${page.url().slice(0, 80)})`);
      this.page = null;
    });
    const category = this.config.categories?.[0] || "all";
    await page.goto(`${ORIGIN}/tasks-all-opened-${category}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(8_000 + Math.random() * 4_000);

    const title = await page.title().catch(() => "");
    if (!/YouDo|задани/i.test(title)) {
      this.callbacks?.onStatus?.(`защита не пропустила: "${title.slice(0, 60)}"`);
      await this.closeBrowser();
      return null;
    }

    this.page = page;
    this.pageOpenedAt = Date.now();
    this.callbacks?.onStatus?.("лента открыта");
    return page;
  }

  private async closeBrowser(): Promise<void> {
    this.page = null;
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.context = null;
    this.browser = null;
  }

  private remember(ids: number[]): void {
    const set = new Set(this.seen.ids);
    for (const id of ids) set.add(id);
    this.seen.ids = Array.from(set).sort((a, b) => b - a).slice(0, SEEN_MAX);
  }

  private saveSeen(): void {
    writeJsonFile(this.statePath, this.seen);
  }

  private isOutsideWorkHours(): boolean {
    const h = mskHour();
    return h < hourOf(this.config.workHoursStart, 8) || h >= hourOf(this.config.workHoursEnd, 22);
  }

  private nextDelayMs(): number {
    return pickPollDelayMs(this.config.pollStepsSec);
  }
}
