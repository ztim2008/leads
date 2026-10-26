import { CHROME_UA, MOBILE_UA, clearPopups, guard, openPage } from "@/lib/diagnost/render";
import { COLLECT_CLICKS, FLATTEN_STICKY, PROBE_ARM, PROBE_DISPATCH, PROBE_READ, SCROLL_THROUGH, SCROLL_TO, TOGGLE_FIXED } from "@/lib/rentgen/collect";
import { attendView, openAttention, type AttentionModel } from "@/lib/rentgen/attention";
import { collectIssues } from "@/lib/rentgen/issues";
import { rentgenShotPath } from "@/lib/rentgen/shots";
import { checkLinks, pickLinks, type LinkCheck } from "@/lib/rentgen/links";
import type { ClickItem, RawClick, RawView, RentgenResult, RentgenView, ViewKind } from "@/lib/rentgen/types";

type Browser = import("playwright").Browser;
type BrowserContext = import("playwright").BrowserContext;
type Page = import("playwright").Page;

const VIEWS: Record<ViewKind, { width: number; height: number; maxHeight: number; probes: number; probeMs: number }> = {
  desktop: { width: 1440, height: 900, maxHeight: 8000, probes: 20, probeMs: 25_000 },
  mobile: { width: 390, height: 844, maxHeight: 6000, probes: 10, probeMs: 12_000 },
};
/** WCAG 2.2 AA (2.5.8): цель от 24×24 px или круг 24 px вокруг центра не задевает соседние цели */
const TARGET_PX = 24;
const ANALYTICS = /mc\.yandex|yandex\.ru\/(clck|watch)|google-analytics|googletagmanager|doubleclick|top-fwz1\.mail\.ru|vk\.com\/rtrg|facebook\.(com|net)|pixel/i;
const MESSENGER_HOSTS = /^(t\.me|telegram\.me|wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|vk\.me|max\.ru|viber\.click|invite\.viber\.com)$/i;


const emptyHref = (href: string | null) => !href || href === "#" || /^javascript:/i.test(href);

function needsProbe(raw: RawClick): boolean {
  if (raw.onclick || raw.submenu || raw.active) return false;
  if (raw.tag === "a") return emptyHref(raw.hrefRaw?.trim() ?? null) || raw.anchorExists === false;
  if (!raw.interactive) return true;
  return !((raw.inForm || raw.formAttr) && raw.submit);
}

function cramped(raw: RawClick, all: RawClick[]): boolean {
  const { x, y, w, h } = raw.box;
  if (raw.inlineText || (w >= TARGET_PX && h >= TARGET_PX)) return false;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = TARGET_PX / 2;
  return all.some((other) => {
    if (other === raw) return false;
    const b = other.box;
    const nx = Math.max(b.x, Math.min(cx, b.x + b.w));
    const ny = Math.max(b.y, Math.min(cy, b.y + b.h));
    return (nx - cx) ** 2 + (ny - cy) ** 2 < r * r;
  });
}

function classify(raw: RawClick, probed: boolean | null | undefined, view: ViewKind, all: RawClick[]): Omit<ClickItem, "n"> {
  const base = { label: raw.label, box: raw.box, path: raw.path };
  const href = raw.hrefRaw?.trim() ?? null;
  let item: Omit<ClickItem, "n">;

  if (raw.tag === "a" && !emptyHref(href)) {
    const link = href ?? "";
    const abs = raw.hrefAbs ?? link;
    if (link.startsWith("#")) {
      if (/^#[!/]/.test(link)) item = { ...base, kind: "ok", href: link, reason: "Переход внутри приложения" };
      else if (raw.anchorExists === false)
        item =
          probed === true
            ? { ...base, kind: "ok", href: link, reason: "Открывает окно или блок" }
            : probed === false
              ? { ...base, kind: "dead", href: link, reason: "Якорь ведёт на блок, которого нет на странице" }
              : { ...base, kind: "unknown", href: link, reason: probed === null ? "Элемент перекрыт другим блоком — нажатие не проверить" : "Нажатие не проверяли" };
      else item = { ...base, kind: "ok", href: link, reason: "Переход к блоку на странице" };
    } else if (/^tel:/i.test(link)) {
      const digits = link.replace(/\D/g, "").length;
      item =
        digits >= 10 && digits <= 15
          ? { ...base, kind: "ok", contact: "tel", href: link, reason: "Звонок" }
          : { ...base, kind: "dead", contact: "tel", href: link, reason: "Неполный номер телефона в ссылке" };
    } else if (/^mailto:/i.test(link)) {
      item = link.includes("@")
        ? { ...base, kind: "ok", contact: "mail", href: link, reason: "Письмо" }
        : { ...base, kind: "dead", contact: "mail", href: link, reason: "Нет адреса почты в ссылке" };
    } else if (/^(viber|whatsapp|tg|skype):/i.test(link)) {
      item = { ...base, kind: "ok", contact: "messenger", href: link, reason: "Мессенджер" };
    } else if (/^https?:/i.test(abs)) {
      let host = "";
      try {
        host = new URL(abs).hostname.replace(/^www\./, "");
      } catch {
        /* битый адрес — ниже как ссылка */
      }
      item = MESSENGER_HOSTS.test(host)
        ? { ...base, kind: "ok", contact: "messenger", href: abs, reason: "Мессенджер" }
        : { ...base, kind: "ok", href: abs, reason: "Ссылка" };
    } else {
      item = { ...base, kind: "unknown", href: link, reason: "Нестандартная ссылка" };
    }
  } else if (!needsProbe(raw)) {
    item = {
      ...base,
      kind: "ok",
      reason: raw.submenu ? "Открывает подменю" : raw.active ? "Уже выбрано" : raw.onclick ? "Кнопка со скриптом" : "Кнопка отправки формы",
    };
  } else if (probed === true) {
    item = { ...base, kind: "ok", reason: "Срабатывает по нажатию" };
  } else if (probed === false) {
    item =
      raw.tag === "a"
        ? { ...base, kind: "dead", reason: "Ссылка никуда не ведёт и ничего не делает" }
        : raw.interactive
          ? { ...base, kind: "fake", reason: "Кнопка не реагирует на нажатие — проверьте, возможно, уже выбрана" }
          : { ...base, kind: "fake", reason: "Похоже на кнопку, но не нажимается" };
  } else if (probed === null) {
    item = { ...base, kind: "unknown", reason: "Элемент перекрыт другим блоком — нажатие не проверить" };
  } else {
    item = { ...base, kind: "unknown", reason: "Нажатие не проверяли" };
  }

  if (view === "mobile" && item.kind === "ok" && cramped(raw, all)) {
    item = { ...item, kind: "small", reason: `Мелко и тесно для пальца: ${raw.box.w}×${raw.box.h} px, рядом другие ссылки` };
  }
  return item;
}

function applyCheck(item: Omit<ClickItem, "n">, check: LinkCheck, siteHost: string): Omit<ClickItem, "n"> {
  const internal = new URL(item.href!).hostname.replace(/^www\./, "") === siteHost;
  if (check.status !== null) {
    if (check.status === 404 || check.status === 410 || check.status >= 500 || (internal && check.status >= 400))
      return { ...item, kind: "dead", status: check.status, reason: `Страница по ссылке отвечает ошибкой ${check.status}` };
    if (check.status >= 400) return { ...item, kind: "unknown", status: check.status, reason: "Сайт по ссылке не дал себя проверить" };
    return { ...item, status: check.status };
  }
  if (check.error === "dns") return { ...item, kind: "dead", status: null, reason: "Сайта по ссылке не существует" };
  return { ...item, kind: "unknown", status: null, reason: internal ? "Страница не ответила за 5 секунд" : "Сайт по ссылке не ответил" };
}

function numberProblems(items: Omit<ClickItem, "n">[]): ClickItem[] {
  const sorted = [...items].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  let n = 0;
  return sorted.map((item) => ({ ...item, n: item.kind === "dead" || item.kind === "fake" || item.kind === "small" ? ++n : null }));
}

async function probeAll(page: Page, context: BrowserContext, url: string, paths: string[], budgetMs: number): Promise<Map<string, boolean | null>> {
  const deadline = Date.now() + budgetMs;
  const results = new Map<string, boolean | null>();
  let requests = 0;
  let popup = false;
  let dialog = false;
  const onRequest = (request: import("playwright").Request) => {
    const type = request.resourceType();
    if ((type === "fetch" || type === "xhr" || type === "document") && !ANALYTICS.test(request.url())) requests++;
  };
  const onPage = (opened: Page) => {
    popup = true;
    opened.close().catch(() => undefined);
  };
  const onDialog = (d: import("playwright").Dialog) => {
    dialog = true;
    d.dismiss().catch(() => undefined);
  };
  page.on("request", onRequest);
  context.on("page", onPage);
  page.on("dialog", onDialog);

  const home = new URL(url);
  for (const path of paths) {
    if (Date.now() > deadline) break;
    requests = 0;
    popup = false;
    dialog = false;
    let reacted = false;
    let reload = false;
    let trusted = true;
    try {
      const armed = (await page.evaluate(`(${PROBE_ARM})(${JSON.stringify(path)})`)) as { missing: boolean; base: number };
      if (armed.missing) continue;
      requests = 0;
      try {
        await page.locator(path).first().click({ timeout: 1500, noWaitAfter: true });
      } catch {
        trusted = false;
        await page.evaluate(`(${PROBE_DISPATCH})(${JSON.stringify(path)})`);
      }
      const read = (await page.evaluate(`(${PROBE_READ})()`)) as { after: number; moved: boolean };
      const res = { base: armed.base, ...read };
      await page.waitForTimeout(150);
      const now = new URL(page.url());
      const leftPage = now.origin + now.pathname + now.search !== home.origin + home.pathname + home.search;
      reacted = res.moved || leftPage || popup || dialog || requests > 0 || res.after > res.base * 1.5 + 3;
      reload = leftPage;
      if (reacted && !leftPage) await page.keyboard.press("Escape").catch(() => undefined);
    } catch {
      reacted = true;
      reload = true;
    }
    results.set(path, reacted ? true : trusted ? false : null);
    if (reload) {
      await page.goto(url, { waitUntil: "load", timeout: 30_000 }).catch(() => undefined);
      await page.waitForTimeout(1200);
      await clearPopups(page);
    }
  }

  page.off("request", onRequest);
  context.off("page", onPage);
  page.off("dialog", onDialog);
  return results;
}

/**
 * Снимок страницы кусками по высоте окна и склейка.
 * fullPage не годится: Chromium растягивает окно (captureBeyondViewport), сайт ловит resize
 * и перестраивает вёрстку — рамки, замеренные в обычном окне, съезжают.
 */
async function captureTiles(browser: Browser, page: Page, view: ViewKind, wanted: number, file: string): Promise<number> {
  const spec = VIEWS[view];
  const scale = view === "mobile" ? 2 : 1;
  const tiles: { y: number; data: string }[] = [];
  let last = -1;
  for (let y = 0; y < wanted; y += spec.height) {
    const actual = (await page.evaluate(`(${SCROLL_TO})(${y})`)) as number;
    if (actual <= last) break;
    if (tiles.length === 1) await page.evaluate(`(${TOGGLE_FIXED})(true)`);
    const buffer = await page.screenshot({ type: "jpeg", quality: 82 });
    tiles.push({ y: actual, data: buffer.toString("base64") });
    last = actual;
  }
  await page.evaluate(`(${TOGGLE_FIXED})(false)`);
  await page.evaluate(`(${SCROLL_TO})(0)`);
  const height = Math.min(wanted, last + spec.height);

  const context = await browser.newContext({ viewport: { width: spec.width, height: spec.height }, deviceScaleFactor: scale });
  try {
    const canvas = await context.newPage();
    const imgs = tiles
      .map((tile) => `<img src="data:image/jpeg;base64,${tile.data}" style="position:absolute;left:0;top:${tile.y}px;width:${spec.width}px;height:${spec.height}px">`)
      .join("");
    await canvas.setContent(`<body style="margin:0"><div style="position:relative;width:${spec.width}px;height:${height}px;overflow:hidden">${imgs}</div></body>`);
    await canvas.screenshot({ path: file, type: "jpeg", quality: 72, fullPage: true, clip: { x: 0, y: 0, width: spec.width, height } });
  } finally {
    await context.close().catch(() => undefined);
  }
  return height;
}

async function renderView(
  browser: Browser,
  url: string,
  scanId: string,
  view: ViewKind,
  known: Map<string, boolean | null>,
): Promise<{ view: RentgenView; framework: RawView["framework"]; finalUrl: string }> {
  const spec = VIEWS[view];
  const context = await browser.newContext({
    viewport: { width: spec.width, height: spec.height },
    userAgent: view === "desktop" ? CHROME_UA : MOBILE_UA,
    locale: "ru-RU",
    reducedMotion: "reduce",
    bypassCSP: true,
    ...(view === "mobile" ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}),
  });
  try {
    await guard(context);
    const page = await openPage(context, url);
    const finalUrl = page.url();
    await clearPopups(page);
    await page.evaluate(`(${SCROLL_THROUGH})(${spec.maxHeight})`);
    await page.evaluate(`(${FLATTEN_STICKY})()`);
    await page.waitForTimeout(200);
    const raw = (await page.evaluate(`(${COLLECT_CLICKS})(${spec.maxHeight})`)) as RawView;

    const shot = rentgenShotPath(scanId, view);
    const height = await captureTiles(browser, page, view, Math.min(raw.docHeight, spec.maxHeight), shot);
    raw.items = raw.items.filter((item) => item.box.y < height);
    // До пробных кликов: они открывают окна и меняют страницу
    const issues = await collectIssues(page, view, height).catch((error) => {
      console.error("[rentgen] issues", error instanceof Error ? error.message : error);
      return undefined;
    });

    const suspects = raw.items.filter(needsProbe).sort((a, b) => a.box.y - b.box.y);
    const bySig = new Map<string, string>();
    for (const item of suspects) if (!known.has(item.sig) && !bySig.has(item.sig)) bySig.set(item.sig, item.path);
    const toProbe = [...bySig.values()].slice(0, spec.probes);
    const probed = await probeAll(page, context, finalUrl, toProbe, spec.probeMs);
    for (const [sig, path] of bySig) if (probed.has(path)) known.set(sig, probed.get(path)!);

    const items = numberProblems(raw.items.map((item) => classify(item, known.get(item.sig), view, raw.items)));
    const unprobed = suspects.filter((item) => !known.has(item.sig)).length;
    return {
      view: { shot, width: spec.width, height, truncated: raw.docHeight > spec.maxHeight, items, unprobed, issues },
      framework: raw.framework,
      finalUrl,
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}

/** Слой «Внимание» не обязателен: без весов или при сбое модели отчёт выходит без него */
export async function addAttention(scanId: string, desktop: RentgenView, mobile: RentgenView | null) {
  let model: AttentionModel | null = null;
  try {
    model = await openAttention();
    if (!model) return;
    for (const [kind, view] of [["desktop", desktop], ["mobile", mobile]] as const) {
      if (!view) continue;
      try {
        view.attention = await attendView(model, scanId, kind, view, VIEWS[kind].height);
      } catch (error) {
        console.error("[rentgen] attention", kind, error instanceof Error ? error.message : error);
      }
    }
  } catch (error) {
    console.error("[rentgen] attention", error instanceof Error ? error.message : error);
  } finally {
    await model?.release().catch(() => undefined);
  }
}

export async function renderRentgen(url: string, scanId: string, onProgress: (percent: number) => void = () => undefined): Promise<RentgenResult> {
  const started = Date.now();
  let browser: Browser | null = null;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
    const known = new Map<string, boolean | null>();
    onProgress(10);
    const desktop = await renderView(browser, url, scanId, "desktop", known);
    onProgress(55);
    let mobile: RentgenView | null = null;
    try {
      mobile = (await renderView(browser, desktop.finalUrl, scanId, "mobile", known)).view;
    } catch (error) {
      console.error("[rentgen] mobile", error instanceof Error ? error.message : error);
    }
    onProgress(85);
    const views = [desktop.view, mobile].filter((view): view is RentgenView => view !== null);
    const linkItems = views.flatMap((view) => view.items).filter((item) => (item.kind === "ok" || item.kind === "small") && !item.contact && item.href && /^https?:/i.test(item.href));
    const urls = pickLinks(linkItems.map((item) => item.href!), desktop.finalUrl);
    const checks = await checkLinks(urls);
    const siteHost = new URL(desktop.finalUrl).hostname.replace(/^www\./, "");
    for (const view of views) {
      view.items = numberProblems(
        view.items.map(({ n: _n, ...item }) => {
          const check = item.href && (item.kind === "ok" || item.kind === "small") && !item.contact ? checks.get(item.href.split("#")[0]) : undefined;
          return check ? applyCheck(item, check, siteHost) : item;
        }),
      );
    }
    onProgress(95);
    await addAttention(scanId, desktop.view, mobile);
    return { finalUrl: desktop.finalUrl, framework: desktop.framework, views: { desktop: desktop.view, mobile }, linksChecked: checks.size, ms: Date.now() - started };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
