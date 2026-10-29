// src/agent-core/youdo-collector.ts
import path2 from "node:path";
import { chromium } from "playwright";

// src/agent-core/paths.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
function defaultAgentHome(override) {
  if (override) return override;
  if (process.env.LEADS_AGENT_HOME) return process.env.LEADS_AGENT_HOME;
  return path.join(os.homedir(), ".leads-agent");
}
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writeJsonFile(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}

// src/agent-core/circuit-breaker.ts
var DEFAULTS = {
  failThreshold: 3,
  failWindowMs: 10 * 60 * 1e3,
  openDurationMs: 60 * 60 * 1e3,
  reopenDurationMs: 120 * 60 * 1e3,
  maxOpenCycles: 5
};
function emptySnapshot(now) {
  return {
    state: "CLOSED",
    failCount: 0,
    windowFails: [],
    lastFailAt: null,
    openUntil: null,
    openCycles: 0,
    lastReason: null,
    alerted: false,
    updatedAt: now
  };
}
var CircuitBreaker = class {
  constructor(opts = {}) {
    this.failThreshold = opts.failThreshold ?? DEFAULTS.failThreshold;
    this.failWindowMs = opts.failWindowMs ?? DEFAULTS.failWindowMs;
    this.openDurationMs = opts.openDurationMs ?? DEFAULTS.openDurationMs;
    this.reopenDurationMs = opts.reopenDurationMs ?? DEFAULTS.reopenDurationMs;
    this.maxOpenCycles = opts.maxOpenCycles ?? DEFAULTS.maxOpenCycles;
    this.statePath = opts.statePath;
    this.now = opts.now ?? (() => Date.now());
    this.onStateChange = opts.onStateChange;
    this.snap = this.statePath ? readJsonFile(this.statePath, emptySnapshot(this.now())) : emptySnapshot(this.now());
    this.tick();
  }
  getState() {
    this.tick();
    return { ...this.snap, windowFails: [...this.snap.windowFails] };
  }
  /** true = можно пробовать вход / сбор. */
  canAttempt() {
    this.tick();
    return this.snap.state === "CLOSED" || this.snap.state === "HALF_OPEN";
  }
  /** Успешный вход или успешный цикл сбора. */
  recordSuccess() {
    this.tick();
    const prev = this.snap.state;
    this.snap = {
      ...this.snap,
      state: "CLOSED",
      failCount: 0,
      windowFails: [],
      lastFailAt: null,
      openUntil: null,
      lastReason: null,
      alerted: false,
      updatedAt: this.now()
    };
    this.persist();
    this.emit(prev, "CLOSED");
  }
  /** Ошибка входа / сессии. Никогда не рестартит — только меняет состояние. */
  recordFailure(reason = "login_failed") {
    this.tick();
    const t = this.now();
    const prev = this.snap.state;
    if (prev === "BLOCKED") {
      this.snap = { ...this.snap, lastReason: reason, lastFailAt: t, updatedAt: t };
      this.persist();
      return;
    }
    if (prev === "HALF_OPEN") {
      const openCycles = this.snap.openCycles + 1;
      if (openCycles >= this.maxOpenCycles) {
        this.snap = {
          ...this.snap,
          state: "BLOCKED",
          failCount: this.snap.failCount + 1,
          lastFailAt: t,
          openUntil: null,
          openCycles,
          lastReason: reason,
          alerted: true,
          updatedAt: t
        };
        this.persist();
        this.emit(prev, "BLOCKED");
        return;
      }
      this.snap = {
        ...this.snap,
        state: "OPEN",
        failCount: this.snap.failCount + 1,
        lastFailAt: t,
        openUntil: t + this.reopenDurationMs,
        openCycles,
        lastReason: reason,
        alerted: true,
        updatedAt: t
      };
      this.persist();
      this.emit(prev, "OPEN");
      return;
    }
    if (prev === "OPEN") {
      this.snap = { ...this.snap, lastReason: reason, lastFailAt: t, updatedAt: t };
      this.persist();
      return;
    }
    const windowStart = t - this.failWindowMs;
    const windowFails = [...this.snap.windowFails.filter((x) => x >= windowStart), t];
    const failCount = this.snap.failCount + 1;
    if (windowFails.length >= this.failThreshold) {
      const openCycles = this.snap.openCycles + 1;
      if (openCycles >= this.maxOpenCycles) {
        this.snap = {
          state: "BLOCKED",
          failCount,
          windowFails,
          lastFailAt: t,
          openUntil: null,
          openCycles,
          lastReason: reason,
          alerted: true,
          updatedAt: t
        };
        this.persist();
        this.emit(prev, "BLOCKED");
        return;
      }
      this.snap = {
        state: "OPEN",
        failCount,
        windowFails,
        lastFailAt: t,
        openUntil: t + this.openDurationMs,
        openCycles,
        lastReason: reason,
        alerted: true,
        updatedAt: t
      };
      this.persist();
      this.emit(prev, "OPEN");
      return;
    }
    this.snap = {
      ...this.snap,
      state: "CLOSED",
      failCount,
      windowFails,
      lastFailAt: t,
      lastReason: reason,
      updatedAt: t
    };
    this.persist();
  }
  /** Ручной сброс (кнопка админки / после разблокировки Profi). */
  reset() {
    const prev = this.snap.state;
    this.snap = emptySnapshot(this.now());
    this.persist();
    this.emit(prev, "CLOSED");
  }
  /** Продвинуть OPEN → HALF_OPEN по таймеру. */
  tick() {
    if (this.snap.state !== "OPEN") return;
    const t = this.now();
    if (this.snap.openUntil != null && t >= this.snap.openUntil) {
      const prev = "OPEN";
      this.snap = {
        ...this.snap,
        state: "HALF_OPEN",
        openUntil: null,
        updatedAt: t
      };
      this.persist();
      this.emit(prev, "HALF_OPEN");
    }
  }
  persist() {
    if (!this.statePath) return;
    writeJsonFile(this.statePath, this.snap);
  }
  emit(prev, next) {
    if (prev === next || !this.onStateChange) return;
    this.onStateChange(prev, next, this.getState());
  }
};

// src/agent-core/profiles.ts
function sleep(ms) {
  const actual = ms * (0.85 + Math.random() * 0.3);
  return new Promise((resolve) => setTimeout(resolve, actual));
}

// src/agent-core/youdo-collector.ts
var ORIGIN = "https://youdo.com";
var BLOCKED_HOSTS = /api-maps\.yandex|maps\.yandex|front-maps|core-renderer-tiles|mc\.yandex|yandex\.ru\/adfox|adfox|sentry\.youdo|traces\.youdo|googletagmanager|google-analytics|vk\.com\/rtrg|top-fwz1|facebook/i;
var SEEN_MAX = 3e3;
var PAGE_REFRESH_MS = 45 * 6e4;
var MIN_POLL_SEC = 45;
var DEFAULT_POLL_STEPS_SEC = [60, 180, 360];
var POLL_JITTER = 0.2;
function parseYouDoBudget(desc, amount) {
  if (amount && amount > 0) return amount;
  const m = String(desc || "").replace(/\u00a0/g, " ").match(/(\d[\d\s]*)/);
  if (!m) return void 0;
  const v = parseInt(m[1].replace(/\s/g, ""), 10);
  return Number.isFinite(v) && v > 0 ? v : void 0;
}
function pickPollDelayMs(stepsSec, rnd = Math.random) {
  const steps = (stepsSec || []).filter((n) => Number.isFinite(n) && n > 0);
  const pool = steps.length ? steps : DEFAULT_POLL_STEPS_SEC;
  const base = pool[Math.floor(rnd() * pool.length)] ?? pool[0];
  const jittered = base * (1 - POLL_JITTER + rnd() * 2 * POLL_JITTER);
  return Math.round(Math.max(MIN_POLL_SEC, jittered) * 1e3);
}
function mskHour(now = Date.now()) {
  return new Date(now + 3 * 36e5).getUTCHours();
}
function hourOf(s, fallback) {
  const h = parseInt(String(s || "").split(":")[0] || "", 10);
  return Number.isFinite(h) ? h : fallback;
}
var YouDoCollector = class {
  constructor(config) {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.pageOpenedAt = 0;
    this.timer = null;
    this.running = false;
    this.callbacks = null;
    this.lastFeedOkAt = null;
    this.config = config;
    const home = path2.join(defaultAgentHome(config.agentHome), "youdo", config.sourceId);
    this.statePath = path2.join(home, "seen.json");
    this.seen = readJsonFile(this.statePath, { ids: [], seededAt: null });
    this.breaker = new CircuitBreaker({
      statePath: path2.join(home, "circuit-breaker.json"),
      onStateChange: (prev, next, snap) => {
        this.callbacks?.onCircuitChange?.(snap);
        this.callbacks?.onStatus?.(
          `CB ${prev}\u2192${next}` + (snap.openUntil ? ` until ${new Date(snap.openUntil).toISOString()}` : "")
        );
      }
    });
  }
  updateRuntime(patch) {
    Object.assign(this.config, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== void 0)));
  }
  getBreakerState() {
    return this.breaker.getState();
  }
  getLastFeedOkAt() {
    return this.lastFeedOkAt ? new Date(this.lastFeedOkAt).toISOString() : null;
  }
  async start(callbacks) {
    if (this.running) return;
    this.running = true;
    this.callbacks = callbacks;
    callbacks.onStatus?.("youdo collector started");
    const loop = async () => {
      if (!this.running) return;
      if (!this.breaker.canAttempt()) {
        const s = this.breaker.getState();
        const waitMs = s.state === "OPEN" && s.openUntil ? Math.max(5e3, s.openUntil - Date.now()) : 6e4;
        callbacks.onStatus?.(`CB ${s.state}: \u0442\u0438\u0445\u0438\u0439 \u0440\u0435\u0436\u0438\u043C ${Math.round(waitMs / 6e4)} \u043C\u0438\u043D`);
        this.timer = setTimeout(loop, Math.min(waitMs, 15 * 6e4));
        return;
      }
      if (this.isOutsideWorkHours()) {
        await this.closeBrowser();
        callbacks.onStatus?.("\u0432\u043D\u0435 \u0440\u0430\u0431\u043E\u0447\u0438\u0445 \u0447\u0430\u0441\u043E\u0432, \u043F\u0430\u0443\u0437\u0430 15 \u043C\u0438\u043D");
        this.timer = setTimeout(loop, 15 * 6e4);
        return;
      }
      try {
        await this.runOnce();
      } catch (err) {
        callbacks.onError?.(err instanceof Error ? err.message : String(err));
      }
      const delay = this.nextDelayMs();
      callbacks.onStatus?.(`\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0447\u0435\u0440\u0435\u0437 ${Math.round(delay / 1e3)} \u0441`);
      this.timer = setTimeout(loop, delay);
    };
    await loop();
  }
  async stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.closeBrowser();
  }
  async runOnce() {
    let feed = await this.fetchFeed();
    if (!feed.ok) {
      this.callbacks?.onStatus?.(`\u0441\u0431\u043E\u0439 \u043B\u0435\u043D\u0442\u044B (${feed.reason}), \u043F\u0435\u0440\u0435\u043E\u0442\u043A\u0440\u044B\u0432\u0430\u044E \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443`);
      await this.closeBrowser();
      await sleep(5e3 + Math.random() * 5e3);
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
      this.callbacks?.onStatus?.(`\u043F\u0435\u0440\u0432\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A: ${feed.items.length} \u0437\u0430\u0434\u0430\u043D\u0438\u0439 \u043F\u043E\u043C\u0435\u0447\u0435\u043D\u044B \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043D\u044B\u043C\u0438`);
      return;
    }
    this.callbacks?.onStatus?.(`\u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430: ${feed.items.length} \u0432 \u043B\u0435\u043D\u0442\u0435, \u043D\u043E\u0432\u044B\u0445 ${fresh.length}`);
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
  toLead(item, description) {
    const budget = parseYouDoBudget(item.BudgetDescription, item.PriceAmount);
    const reviews = item.CreatorInfo?.Rating?.SummaryReviews;
    return {
      externalId: `youdo-${item.Id}`,
      title: String(item.Name || "").slice(0, 150),
      description: (description || item.Name || "").slice(0, 3e3),
      url: `${ORIGIN}/t${item.Id}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      author: item.CreatorInfo?.UserName || void 0,
      budgetMax: budget,
      responses: typeof item.OffersCount === "number" ? item.OffersCount : void 0,
      remote: !item.Address,
      reviewCount: typeof reviews === "number" ? reviews : void 0
    };
  }
  async fetchFeed() {
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
      categories: this.config.categories?.length ? this.config.categories : ["all"]
    };
    const res = await page.evaluate(async (payload) => {
      try {
        const r = await fetch("/api/tasks/tasks/", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
          credentials: "include"
        });
        const ct = r.headers.get("content-type") || "";
        if (!ct.includes("json")) return { status: r.status, json: null };
        return { status: r.status, json: await r.json() };
      } catch (e) {
        return { status: 0, json: null, error: String(e) };
      }
    }, body).catch((e) => ({ status: 0, json: null, error: String(e) }));
    const json = res.json;
    if (!json) {
      const detail = "error" in res && res.error ? `: ${String(res.error).slice(0, 120)}` : "";
      return { ok: false, reason: `http_${res.status || "err"}_not_json${detail}` };
    }
    if (json.IsSuccess === false) return { ok: false, reason: "api_not_success" };
    return { ok: true, items: json.ResultObject?.Items || [] };
  }
  async fetchDescription(taskId) {
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
  async ensurePage() {
    if (this.page && Date.now() - this.pageOpenedAt < PAGE_REFRESH_MS) return this.page;
    await this.closeBrowser();
    const launchOpts = {
      headless: this.config.headless !== false,
      args: ["--disable-blink-features=AutomationControlled", "--disable-dev-shm-usage", "--disable-gpu"]
    };
    this.browser = await chromium.launch({ ...launchOpts, channel: "chromium" }).catch(() => chromium.launch(launchOpts));
    this.context = await this.browser.newContext({
      viewport: { width: 1366, height: 800 },
      locale: "ru-RU",
      timezoneId: "Europe/Moscow",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
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
      this.callbacks?.onStatus?.("\u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u0443\u043F\u0430\u043B, \u043E\u0442\u043A\u0440\u043E\u0435\u0442\u0441\u044F \u0437\u0430\u043D\u043E\u0432\u043E \u043D\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0435");
      this.page = null;
      this.context = null;
      this.browser = null;
    });
    const page = await this.context.newPage();
    page.on("crash", () => this.callbacks?.onStatus?.("\u0434\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u043A\u0430: \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0443\u043F\u0430\u043B\u0430 (crash)"));
    page.on("close", () => {
      if (this.page !== page) return;
      this.callbacks?.onStatus?.(`\u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0437\u0430\u043A\u0440\u044B\u0442\u0430 \u0438\u0437\u0432\u043D\u0435 (${page.url().slice(0, 80)})`);
      this.page = null;
    });
    const category = this.config.categories?.[0] || "all";
    await page.goto(`${ORIGIN}/tasks-all-opened-${category}`, { waitUntil: "domcontentloaded", timeout: 45e3 });
    await page.waitForTimeout(8e3 + Math.random() * 4e3);
    const title = await page.title().catch(() => "");
    if (!/YouDo|задани/i.test(title)) {
      this.callbacks?.onStatus?.(`\u0437\u0430\u0449\u0438\u0442\u0430 \u043D\u0435 \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u043B\u0430: "${title.slice(0, 60)}"`);
      await this.closeBrowser();
      return null;
    }
    this.page = page;
    this.pageOpenedAt = Date.now();
    this.callbacks?.onStatus?.("\u043B\u0435\u043D\u0442\u0430 \u043E\u0442\u043A\u0440\u044B\u0442\u0430");
    return page;
  }
  async closeBrowser() {
    this.page = null;
    await this.context?.close().catch(() => {
    });
    await this.browser?.close().catch(() => {
    });
    this.context = null;
    this.browser = null;
  }
  remember(ids) {
    const set = new Set(this.seen.ids);
    for (const id of ids) set.add(id);
    this.seen.ids = Array.from(set).sort((a, b) => b - a).slice(0, SEEN_MAX);
  }
  saveSeen() {
    writeJsonFile(this.statePath, this.seen);
  }
  isOutsideWorkHours() {
    const h = mskHour();
    return h < hourOf(this.config.workHoursStart, 8) || h >= hourOf(this.config.workHoursEnd, 22);
  }
  nextDelayMs() {
    return pickPollDelayMs(this.config.pollStepsSec);
  }
};

// src/agent-core/youdo-agent.ts
var API = process.env.API_URL || "https://leads.konversus.ru";
var SECRET = process.env.AGENT_SECRET || "leads-agent-secret-2026";
var SOURCE_ID = process.env.SOURCE_ID || "";
if (!SOURCE_ID) {
  console.error("[youdo-agent] \u274C SOURCE_ID \u043D\u0435 \u0437\u0430\u0434\u0430\u043D");
  process.exit(1);
}
var startTime = Date.now();
var totalErrors = 0;
var totalLeadsSent = 0;
var lastError = "";
var lastErrorTime = "";
var agentState = "init";
async function apiPost(path3, payload) {
  const res = await fetch(`${API}/api/v2/agent/${path3}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: SECRET, sourceId: SOURCE_ID, ...payload }),
    signal: AbortSignal.timeout(2e4)
  });
  try {
    return await res.json();
  } catch {
    return { error: `http ${res.status}` };
  }
}
async function loadConfig() {
  const url = `${API}/api/v2/agent/config?secret=${encodeURIComponent(SECRET)}&sourceId=${encodeURIComponent(SOURCE_ID)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(2e4) });
  if (!res.ok) throw new Error(`config fetch failed: ${res.status}`);
  const cfg = await res.json();
  if (cfg.error) throw new Error(cfg.error);
  if (cfg.platform !== "youdo") throw new Error(`source platform is ${cfg.platform}, expected youdo`);
  return cfg;
}
async function heartbeat(cb, lastFeedOkAt) {
  await apiPost("heartbeat", {
    status: {
      leads: totalLeadsSent,
      errors: totalErrors,
      uptime: Math.floor((Date.now() - startTime) / 1e3),
      memory: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024),
      lastError,
      lastErrorTime,
      agentState,
      circuitBreaker: cb || null,
      lastFeedOkAt: lastFeedOkAt || null
    }
  });
}
function runtimeFrom(cfg) {
  return {
    categories: cfg.youdo?.categories,
    onlyVirtual: cfg.youdo?.onlyVirtual,
    pollStepsSec: cfg.youdo?.pollStepsSec,
    workHoursStart: cfg.workHoursStart,
    workHoursEnd: cfg.workHoursEnd
  };
}
async function main() {
  console.log("[youdo-agent] \u{1F680} \u0417\u0430\u043F\u0443\u0441\u043A", SOURCE_ID, "API:", API);
  const config = await loadConfig();
  if (config.collectionPaused) {
    console.log("[youdo-agent] \u23F8 \u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D \u043D\u0430 \u0445\u0430\u0431\u0435. Heartbeat only.");
    agentState = "paused";
    setInterval(() => heartbeat().catch(() => {
    }), 5 * 6e4);
    await heartbeat();
    return;
  }
  const collector = new YouDoCollector({ sourceId: SOURCE_ID, headless: true, ...runtimeFrom(config) });
  setInterval(() => {
    loadConfig().then((cfg) => collector.updateRuntime(runtimeFrom(cfg))).catch((e) => console.error("[youdo-agent] config refresh:", e instanceof Error ? e.message : e));
  }, 2 * 6e4);
  setInterval(() => {
    heartbeat(collector.getBreakerState(), collector.getLastFeedOkAt()).catch(
      (e) => console.error("[youdo-agent] heartbeat:", e instanceof Error ? e.message : e)
    );
  }, 5 * 6e4);
  agentState = "running";
  await heartbeat(collector.getBreakerState(), collector.getLastFeedOkAt());
  await collector.start({
    onLead: async (lead) => {
      const res = await apiPost("leads", { leads: [lead] });
      const saved = typeof res.saved === "number" ? res.saved : 0;
      totalLeadsSent += saved;
      console.log(`[youdo-agent] ${saved > 0 ? "\u{1F4E5}" : "\xB7"} ${lead.title?.slice(0, 60)}`);
    },
    onError: (err) => {
      totalErrors++;
      lastError = err;
      lastErrorTime = (/* @__PURE__ */ new Date()).toISOString();
      console.error("[youdo-agent] \u274C", err);
    },
    onStatus: (s) => {
      console.log("[youdo-agent]", s);
      if (/^проверка:|лента открыта/.test(s)) {
        lastError = "";
        lastErrorTime = "";
      }
    },
    onCircuitChange: async (snap) => {
      if (snap.state === "OPEN") agentState = "cooldown";
      else if (snap.state === "BLOCKED") agentState = "blocked";
      else if (snap.state === "CLOSED") agentState = "running";
      if (snap.state === "OPEN" || snap.state === "BLOCKED") {
        await apiPost("alert", {
          type: `youdo_cb_${snap.state.toLowerCase()}`,
          message: snap.lastReason || snap.state,
          circuitBreaker: snap
        }).catch(() => {
        });
      }
      await heartbeat(snap, collector.getLastFeedOkAt()).catch(() => {
      });
    }
  });
}
main().catch((e) => {
  console.error("[youdo-agent] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
