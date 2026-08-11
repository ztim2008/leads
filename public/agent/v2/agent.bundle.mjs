// src/agent-core/profi-collector.ts
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
function profileDir(agentHome, sourceId) {
  return path.join(agentHome, "profiles", sourceId);
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
var BROWSER_PROFILES = [
  {
    id: "win-chrome-1",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    platform: "Win32",
    hasTouch: false,
    os: "Windows 10",
    locale: "ru-RU"
  },
  {
    id: "win-chrome-2",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    viewport: { width: 1536, height: 864 },
    deviceScaleFactor: 1,
    platform: "Win32",
    hasTouch: false,
    os: "Windows 10",
    locale: "ru-RU"
  },
  {
    id: "win-chrome-3",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    platform: "Win32",
    hasTouch: false,
    os: "Windows 10",
    locale: "ru-RU"
  },
  {
    id: "win-edge-1",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    platform: "Win32",
    hasTouch: false,
    os: "Windows 10",
    locale: "ru-RU"
  },
  {
    id: "mac-chrome-1",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    platform: "MacIntel",
    hasTouch: false,
    os: "macOS 10.15",
    locale: "ru-RU"
  },
  {
    id: "mac-chrome-2",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    viewport: { width: 1728, height: 1117 },
    deviceScaleFactor: 2,
    platform: "MacIntel",
    hasTouch: false,
    os: "macOS 10.15",
    locale: "ru-RU"
  }
];
var STEALTH_PROFILES = [
  {
    id: "stealth-win-chrome",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    platform: "Win32",
    hasTouch: false,
    os: "Windows 10",
    locale: "ru-RU"
  }
];
function pickDifferentProfile(previousId, stealth = false) {
  const pool = stealth ? [...BROWSER_PROFILES, ...STEALTH_PROFILES] : BROWSER_PROFILES;
  const filtered = previousId ? pool.filter((p) => p.id !== previousId) : pool;
  return filtered[Math.floor(Math.random() * filtered.length)];
}
function randomCheckIntervalMs(minMin = 3, maxMin = 7) {
  const minutes = minMin + Math.random() * (maxMin - minMin);
  return minutes * 60 * 1e3 * (0.85 + Math.random() * 0.3);
}
function sleep(ms) {
  const actual = ms * (0.85 + Math.random() * 0.3);
  return new Promise((resolve) => setTimeout(resolve, actual));
}

// src/agent-core/human.ts
async function humanType(page, selector, text) {
  await page.click(selector, { delay: 80 + Math.random() * 120 });
  await sleep(200 + Math.random() * 300);
  await page.fill(selector, "");
  await sleep(100 + Math.random() * 150);
  for (let i = 0; i < text.length; i++) {
    const delay = 60 + Math.random() * 140;
    await page.type(selector, text[i], { delay });
    if (Math.random() < 0.05 && i < text.length - 1) {
      await sleep(800 + Math.random() * 1200);
    }
  }
}
async function humanClick(page, selector) {
  const element = await page.$(selector);
  if (!element) {
    await page.click(selector);
    return;
  }
  const box = await element.boundingBox();
  if (!box) {
    await page.click(selector);
    return;
  }
  const targetX = box.x + box.width * (0.2 + Math.random() * 0.6);
  const targetY = box.y + box.height * (0.2 + Math.random() * 0.6);
  const startX = targetX - 100 + Math.random() * 200;
  const startY = targetY - 50 + Math.random() * 100;
  await mouseMoveBezier(page, startX, startY, targetX, targetY);
  await sleep(50 + Math.random() * 120);
  await page.mouse.click(targetX, targetY, { delay: 30 + Math.random() * 70 });
}
async function humanScroll(page, distanceY) {
  const steps = 3 + Math.floor(Math.random() * 5);
  const stepSize = distanceY / steps;
  for (let i = 0; i < steps; i++) {
    const actualStep = stepSize * (0.6 + Math.random() * 0.8);
    await page.evaluate((y) => window.scrollBy(0, y), actualStep);
    await sleep(300 + Math.random() * 800);
  }
}
async function mouseMoveBezier(page, startX, startY, endX, endY) {
  const cp1x = startX + (endX - startX) * 0.25 + (Math.random() - 0.5) * 100;
  const cp1y = startY + (endY - startY) * 0.25 + (Math.random() - 0.5) * 80;
  const cp2x = startX + (endX - startX) * 0.75 + (Math.random() - 0.5) * 100;
  const cp2y = startY + (endY - startY) * 0.75 + (Math.random() - 0.5) * 80;
  const dist = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
  const steps = Math.max(5, Math.min(30, Math.floor(dist / 20)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) ** 3 * startX + 3 * (1 - t) ** 2 * t * cp1x + 3 * (1 - t) * t ** 2 * cp2x + t ** 3 * endX;
    const y = (1 - t) ** 3 * startY + 3 * (1 - t) ** 2 * t * cp1y + 3 * (1 - t) * t ** 2 * cp2y + t ** 3 * endY;
    await page.mouse.move(x, y);
    const baseDelay = 5 + Math.random() * 8;
    const speedFactor = 0.5 + Math.abs(t - 0.5) * 1.5;
    await sleep(baseDelay * speedFactor);
  }
}

// src/agent-core/profile-store.ts
import fs2 from "node:fs";
import path2 from "node:path";
var ProfileStore = class {
  constructor(sourceId, agentHome) {
    this.sourceId = sourceId;
    this.root = profileDir(defaultAgentHome(agentHome), sourceId);
    ensureDir(this.root);
    ensureDir(this.chromiumDir());
  }
  chromiumDir() {
    return path2.join(this.root, "chromium");
  }
  cookiesPath() {
    return path2.join(this.root, "cookies.json");
  }
  localStoragePath() {
    return path2.join(this.root, "localStorage.json");
  }
  metaPath() {
    return path2.join(this.root, "meta.json");
  }
  cbStatePath() {
    return path2.join(this.root, "state.json");
  }
  getMeta() {
    return readJsonFile(this.metaPath(), {
      sourceId: this.sourceId,
      profileId: "",
      lastLoginAt: null,
      cookiesSavedAt: null
    });
  }
  setMeta(patch) {
    const next = { ...this.getMeta(), ...patch, sourceId: this.sourceId };
    writeJsonFile(this.metaPath(), next);
    return next;
  }
  saveCookies(cookies) {
    const savedAt = Date.now();
    writeJsonFile(this.cookiesPath(), { cookies, savedAt });
    this.setMeta({ cookiesSavedAt: savedAt });
  }
  loadCookies() {
    const data = readJsonFile(this.cookiesPath(), null);
    if (!data || !Array.isArray(data.cookies) || data.cookies.length === 0) return null;
    return data.cookies;
  }
  saveLocalStorage(entries, origin = "https://profi.ru") {
    writeJsonFile(this.localStoragePath(), {
      entries,
      origin,
      savedAt: Date.now()
    });
  }
  loadLocalStorage() {
    const data = readJsonFile(this.localStoragePath(), null);
    if (!data || !data.entries || Object.keys(data.entries).length === 0) return null;
    return data;
  }
  /** Есть ли сохранённые куки для повторного использования сессии. */
  hasSession() {
    return this.loadCookies() != null;
  }
  clearSession() {
    for (const p of [this.cookiesPath(), this.localStoragePath()]) {
      try {
        if (fs2.existsSync(p)) fs2.unlinkSync(p);
      } catch {
      }
    }
    this.setMeta({ lastLoginAt: null, cookiesSavedAt: null });
  }
  saveBrowserProfile(profile) {
    this.setMeta({ profileId: profile.id });
    writeJsonFile(path2.join(this.root, "browser-profile.json"), profile);
  }
  loadBrowserProfile() {
    return readJsonFile(path2.join(this.root, "browser-profile.json"), null);
  }
};

// src/agent-core/profi-collector.ts
var LOGIN_URL = "https://profi.ru/backoffice/n.php";
var FEED_URL = "https://profi.ru/backoffice/n.php";
var ProfiCollector = class {
  constructor(config, breaker) {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.timer = null;
    this.running = false;
    this.knownHrefs = /* @__PURE__ */ new Set();
    this.loginAttempts = 0;
    this.callbacks = null;
    this.config = config;
    this.profiles = new ProfileStore(config.sourceId, config.agentHome);
    this.breaker = breaker ?? new CircuitBreaker({
      statePath: this.profiles.cbStatePath(),
      onStateChange: (prev, next, snap) => {
        this.callbacks?.onCircuitChange?.(snap);
        this.callbacks?.onStatus?.(
          `CB ${prev}\u2192${next}` + (snap.openUntil ? ` until ${new Date(snap.openUntil).toISOString()}` : "")
        );
      }
    });
  }
  getLoginAttemptCount() {
    return this.loginAttempts;
  }
  /** Один цикл: проверка CB → сессия → лента → leads. Без рестартов. */
  async runOnce() {
    if (!this.breaker.canAttempt()) {
      const s = this.breaker.getState();
      this.callbacks?.onStatus?.(
        `CB ${s.state}: \u0441\u0431\u043E\u0440 \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D` + (s.openUntil ? ` (\u0434\u043E ${new Date(s.openUntil).toISOString()})` : "")
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
      if (/login|вход|сесси|expired|auth/i.test(msg)) {
        this.breaker.recordFailure(msg);
        await this.closeBrowser();
        this.profiles.clearSession();
      }
      return [];
    }
  }
  /** Цикл с одним планировщиком. stop() — единственный способ остановить. */
  async start(callbacks) {
    if (this.running) return;
    this.running = true;
    this.callbacks = callbacks;
    callbacks.onStatus?.("collector started");
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
        const waitMs = this.msUntilWakeUp();
        callbacks.onStatus?.(`\u0432\u043D\u0435 \u0440\u0430\u0431\u043E\u0447\u0438\u0445 \u0447\u0430\u0441\u043E\u0432, \u0441\u043E\u043D ~${Math.round(waitMs / 36e5)}\u0447`);
        this.timer = setTimeout(loop, Math.min(waitMs, 60 * 6e4));
        return;
      }
      const leads = await this.runOnce();
      for (const lead of leads) {
        await callbacks.onLead(lead);
      }
      const nextMs = this.breaker.canAttempt() ? randomCheckIntervalMs(3, 7) : Math.max(6e4, (this.breaker.getState().openUntil ?? Date.now() + 6e4) - Date.now());
      this.timer = setTimeout(loop, nextMs);
    };
    await loop();
  }
  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    void this.closeBrowser();
    this.callbacks?.onStatus?.("collector stopped");
  }
  // ─── Session ───────────────────────────────────────────────
  async ensureSession() {
    if (!this.breaker.canAttempt()) return false;
    if (this.page) {
      try {
        const body = await this.page.locator("body").innerText({ timeout: 1e4 });
        if (!body.includes("\u0412\u0445\u043E\u0434 \u0438 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F") && !body.includes("\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u043F\u0430\u0440\u043E\u043B\u044C")) {
          return true;
        }
      } catch {
      }
      await this.closeBrowser();
    }
    return this.login();
  }
  async login() {
    if (!this.breaker.canAttempt()) {
      this.callbacks?.onStatus?.("CB blocks login");
      return false;
    }
    this.loginAttempts += 1;
    const stealth = this.config.antiDetect?.mode === "stealth";
    const prevId = this.profiles.getMeta().profileId || void 0;
    const profile = this.profiles.loadBrowserProfile() ?? pickDifferentProfile(prevId, stealth);
    try {
      this.browser = await chromium.launch({
        headless: this.config.headless !== false,
        timeout: 3e4
      });
      const contextOptions = {
        viewport: profile.viewport,
        userAgent: profile.userAgent,
        locale: profile.locale,
        timezoneId: "Europe/Moscow",
        deviceScaleFactor: profile.deviceScaleFactor,
        hasTouch: profile.hasTouch,
        storageState: void 0
      };
      if (this.config.proxy) {
        contextOptions.proxy = { server: this.config.proxy };
      }
      const cookies = this.profiles.loadCookies();
      this.context = await this.browser.newContext(contextOptions);
      await this.context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => false });
      });
      if (cookies) {
        await this.context.addCookies(cookies);
      }
      this.page = await this.context.newPage();
      await sleep(800 + Math.random() * 1200);
      await this.page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 3e4 });
      const body0 = await this.page.locator("body").innerText();
      if (!body0.includes("\u0412\u0445\u043E\u0434 \u0438 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F") && !body0.includes("\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u043F\u0430\u0440\u043E\u043B\u044C")) {
        this.profiles.saveBrowserProfile(profile);
        this.profiles.setMeta({ lastLoginAt: Date.now(), profileId: profile.id });
        await this.persistSession();
        this.breaker.recordSuccess();
        this.callbacks?.onStatus?.("\u0441\u0435\u0441\u0441\u0438\u044F \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u0438\u0437 \u043F\u0440\u043E\u0444\u0438\u043B\u044F");
        return true;
      }
      await this.page.waitForSelector('[data-testid="auth_login_input"]', { timeout: 15e3 });
      await humanType(this.page, '[data-testid="auth_login_input"]', this.config.login);
      await sleep(300 + Math.random() * 500);
      await humanType(this.page, 'input[type="password"]', this.config.password);
      await sleep(400 + Math.random() * 600);
      await humanClick(this.page, '[data-testid="enter_with_sms_btn"]');
      await sleep(4e3 + Math.random() * 4e3);
      const body = await this.page.locator("body").innerText();
      if (body.includes("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u043B\u043E\u0433\u0438\u043D") || body.includes("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u043F\u0430\u0440\u043E\u043B\u044C") || body.includes("\u0412\u0445\u043E\u0434 \u0438 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F") || body.includes("\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u043F\u0430\u0440\u043E\u043B\u044C")) {
        throw new Error("login_failed: \u0444\u043E\u0440\u043C\u0430 \u0432\u0445\u043E\u0434\u0430 / \u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043F\u0430\u0440\u043E\u043B\u044C / SMS / \u043A\u0430\u043F\u0447\u0430");
      }
      this.profiles.saveBrowserProfile(profile);
      this.profiles.setMeta({ lastLoginAt: Date.now(), profileId: profile.id });
      await this.persistSession();
      this.breaker.recordSuccess();
      this.callbacks?.onStatus?.("\u0432\u0445\u043E\u0434 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.breaker.recordFailure(msg);
      this.callbacks?.onError?.(msg);
      await this.closeBrowser();
      return false;
    }
  }
  async persistSession() {
    if (!this.context) return;
    try {
      const cookies = await this.context.cookies();
      this.profiles.saveCookies(cookies);
    } catch {
    }
  }
  async closeBrowser() {
    try {
      await this.context?.close();
    } catch {
    }
    try {
      await this.browser?.close();
    } catch {
    }
    this.page = null;
    this.context = null;
    this.browser = null;
  }
  // ─── Feed scan ─────────────────────────────────────────────
  async scanFeed() {
    if (!this.page) throw new Error("no page");
    await this.page.goto(FEED_URL, { waitUntil: "domcontentloaded", timeout: 2e4 });
    await sleep(1500 + Math.random() * 2e3);
    const body = await this.page.locator("body").innerText();
    if (body.includes("\u0412\u0445\u043E\u0434 \u0438 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F") || body.includes("\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u043F\u0430\u0440\u043E\u043B\u044C")) {
      throw new Error("session_expired: \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0432\u0445\u043E\u0434");
    }
    const scrolls = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < scrolls; i++) {
      await humanScroll(this.page, 200 + Math.random() * 400);
      await sleep(800 + Math.random() * 1500);
    }
    const links = await this.page.locator('a[href*="?o="]').evaluateAll(
      (els) => els.map((el) => ({
        href: el.href.replace(/&analytics_data=.*$/, ""),
        text: el.innerText?.trim() || ""
      }))
    );
    const leads = [];
    const kw = (this.config.keywords || "").split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    for (const link of links) {
      if (this.knownHrefs.has(link.href)) continue;
      this.knownHrefs.add(link.href);
      if (kw.length > 0) {
        const lower = link.text.toLowerCase();
        if (!kw.some((k) => lower.includes(k))) continue;
      }
      const lines = link.text.split("\n").map((l) => l.trim()).filter(Boolean);
      const title = lines.find(
        (l) => l.length > 3 && l !== "false" && l !== "true" && !/^\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/.test(
          l
        ) && !/^(Вчера|Сегодня|\d+\s+(час|минут|день|дня))/.test(l)
      ) || "\u041D\u043E\u0432\u044B\u0439 \u0437\u0430\u043A\u0430\u0437";
      leads.push({
        externalId: link.href,
        title: title.slice(0, 150),
        description: link.text.replace(/\bfalse\b|\btrue\b/gi, "").replace(/\n{2,}/g, "\n").slice(0, 1e3).trim(),
        url: link.href,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    await this.persistSession();
    this.callbacks?.onStatus?.(`\u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430: ${leads.length} \u043D\u043E\u0432\u044B\u0445`);
    return leads;
  }
  // ─── Work hours (MSK) ──────────────────────────────────────
  parseHour(s, fallback = 8) {
    if (!s) return fallback;
    const h = parseInt(s.split(":")[0] || "", 10);
    return Number.isFinite(h) ? h : fallback;
  }
  mskHour() {
    return new Date(Date.now() + 3 * 60 * 60 * 1e3).getUTCHours();
  }
  isOutsideWorkHours() {
    const start = this.parseHour(this.config.workHoursStart, 8);
    const end = this.parseHour(this.config.workHoursEnd, 22);
    const h = this.mskHour();
    return h < start || h >= end;
  }
  msUntilWakeUp() {
    const start = this.parseHour(this.config.workHoursStart, 8);
    const end = this.parseHour(this.config.workHoursEnd, 22);
    const h = this.mskHour();
    let hours;
    if (h >= end) hours = 24 - h + start;
    else if (h < start) hours = start - h;
    else hours = 1;
    return hours * 60 * 60 * 1e3;
  }
};

// src/agent-core/vps-agent.ts
var API = process.env.API_URL || "https://leads.konversus.ru";
var SECRET = process.env.AGENT_SECRET || "leads-agent-secret-2026";
var SOURCE_ID = process.env.SOURCE_ID || "";
if (!SOURCE_ID) {
  console.error("[agent-v2] \u274C SOURCE_ID \u043D\u0435 \u0437\u0430\u0434\u0430\u043D");
  process.exit(1);
}
var startTime = Date.now();
var totalErrors = 0;
var totalLeadsSent = 0;
var lastError = "";
var lastErrorTime = "";
var agentState = "installing";
async function apiPost(path3, payload) {
  const url = `${API}/api/v2/agent/${path3}`;
  const res = await fetch(url, {
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
  if (!cfg.login || !cfg.password) throw new Error("login/password missing in hub config");
  return cfg;
}
async function heartbeat(cb) {
  const uptime = Math.floor((Date.now() - startTime) / 1e3);
  const mem = Math.floor(process.memoryUsage().heapUsed / 1024 / 1024);
  await apiPost("heartbeat", {
    status: {
      leads: totalLeadsSent,
      errors: totalErrors,
      uptime,
      memory: mem,
      lastError,
      lastErrorTime,
      agentState,
      circuitBreaker: cb || null
    }
  });
}
async function sendAlert(type, message, cb) {
  await apiPost("alert", { type, message, circuitBreaker: cb });
}
async function main() {
  console.log("[agent-v2] \u{1F680} \u0417\u0430\u043F\u0443\u0441\u043A", SOURCE_ID);
  console.log("[agent-v2] API:", API);
  agentState = "init";
  const config = await loadConfig();
  console.log("[agent-v2] \u2705 \u041A\u043E\u043D\u0444\u0438\u0433:", config.login);
  const collector = new ProfiCollector({
    sourceId: SOURCE_ID,
    login: config.login,
    password: config.password,
    keywords: config.keywords,
    workHoursStart: config.workHoursStart,
    workHoursEnd: config.workHoursEnd,
    antiDetect: config.antiDetect,
    proxy: config.proxy,
    headless: true
  });
  agentState = "running";
  setInterval(() => {
    heartbeat(collector.breaker.getState()).catch(
      (e) => console.error("[agent-v2] heartbeat:", e instanceof Error ? e.message : e)
    );
  }, 5 * 60 * 1e3);
  await heartbeat(collector.breaker.getState());
  await collector.start({
    onLead: async (lead) => {
      const res = await apiPost("leads", { leads: [lead] });
      if (res.ok) {
        const saved = typeof res.saved === "number" ? res.saved : 1;
        if (saved > 0) {
          totalLeadsSent += saved;
          console.log("[agent-v2] \u{1F4E5}", lead.title?.slice(0, 60));
        }
      }
    },
    onError: (err) => {
      totalErrors++;
      lastError = err;
      lastErrorTime = (/* @__PURE__ */ new Date()).toISOString();
      console.error("[agent-v2] \u274C", err);
    },
    onStatus: (s) => console.log("[agent-v2]", s),
    onCircuitChange: async (snap) => {
      const next = snap.state;
      if (next === "OPEN") agentState = "cooldown";
      else if (next === "BLOCKED") agentState = "blocked";
      else if (next === "CLOSED") agentState = "running";
      if (next === "OPEN" || next === "BLOCKED") {
        await sendAlert(`cb_${next.toLowerCase()}`, snap.lastReason || next, snap);
      }
      await heartbeat(snap);
    }
  });
}
main().catch((e) => {
  console.error("[agent-v2] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
