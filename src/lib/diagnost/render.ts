import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPrivateIp } from "@/lib/briefs/fetch-site";
import { shotPath } from "@/lib/diagnost/shots";
import type { FoldMark, PerfSignals, RenderSignals, ViewPopup, ViewSignals } from "@/lib/diagnost/types";

export const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 KonversusDiagnost/1.0";
export const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 KonversusDiagnost/1.0";

const STRONG_CTA_SOURCE =
  "заявк|заказ|купить|в корзину|оформить|получить|рассчитать|расч[её]т|консультац|позвон|перезвон|записат|запись|оставить|узнать (?:цену|стоимость)|подобрать|вызвать|отправить|забронир|попробовать|начать|скачать|запросить|оценк|бесплатн";

type Browser = import("playwright").Browser;
type BrowserContext = import("playwright").BrowserContext;
type Page = import("playwright").Page;

const hostCache = new Map<string, boolean>();

async function hostAllowed(hostname: string): Promise<boolean> {
  if (hostCache.has(hostname)) return hostCache.get(hostname)!;
  let ok = false;
  try {
    if (isIP(hostname)) ok = !isPrivateIp(hostname);
    else {
      const records = await lookup(hostname, { all: true, verbatim: true });
      ok = records.length > 0 && !records.some((record) => isPrivateIp(record.address));
    }
  } catch {
    ok = false;
  }
  hostCache.set(hostname, ok);
  return ok;
}

export async function guard(context: BrowserContext) {
  await context.route("**/*", async (route) => {
    try {
      const url = new URL(route.request().url());
      if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
      if (!/^https?:$/.test(url.protocol) || !(await hostAllowed(url.hostname))) return route.abort();
      return route.continue();
    } catch {
      return route.abort();
    }
  });
}

const OBSERVERS = `
  window.__dg = { lcp: null, cls: 0 };
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) window.__dg.lcp = last.renderTime || last.loadTime || last.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__dg.cls += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
  } catch (e) {}
`;

type FoldData = Omit<ViewSignals, "shot" | "width" | "height">;

const COLLECT_FOLD = String.raw`function collectFold(ctaSource) {
  const ctaRe = new RegExp(ctaSource, "i");
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return null;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) < 0.1) return null;
    return rect;
  };
  const box = (rect) => ({
    x: Math.max(0, rect.left / vw),
    y: Math.max(0, (rect.top + window.scrollY) / vh),
    w: Math.min(1, rect.width / vw),
    h: rect.height / vh,
  });
  const inFold = (rect) => rect.top + window.scrollY < vh && rect.bottom > 0 && rect.left < vw && rect.right > 0;
  const marks = [];

  for (const el of Array.from(document.querySelectorAll("h1"))) {
    const rect = visible(el);
    if (rect && inFold(rect)) {
      marks.push({ kind: "h1", label: (el.textContent || "").trim().slice(0, 80), box: box(rect) });
      break;
    }
  }
  let ctaCount = 0;
  const labelOf = (el) => (el.value || el.textContent || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
  for (const el of Array.from(document.querySelectorAll("a, button, input[type=submit], input[type=button], [role=button]"))) {
    if (ctaCount >= 4) break;
    const label = labelOf(el);
    if (!label || !ctaRe.test(label)) continue;
    let target = el;
    let text = label;
    if (label.length > 60) {
      target = null;
      for (const inner of Array.from(el.querySelectorAll("span, div, p, b, strong, i, em"))) {
        const innerText = labelOf(inner);
        if (innerText && innerText.length <= 40 && ctaRe.test(innerText) && visible(inner)) {
          target = inner;
          text = innerText;
          break;
        }
      }
      if (!target) continue;
    }
    const rect = visible(target);
    if (rect && inFold(rect)) {
      marks.push({ kind: "cta", label: text, box: box(rect) });
      ctaCount++;
    }
  }
  for (const el of Array.from(document.querySelectorAll('a[href^="tel:"]'))) {
    const rect = visible(el);
    if (rect && inFold(rect)) {
      marks.push({ kind: "phone", label: (el.textContent || "").trim().slice(0, 40), box: box(rect) });
      break;
    }
  }
  let formTop = null;
  for (const el of Array.from(document.querySelectorAll("form"))) {
    const fields = el.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select');
    if (!fields.length) continue;
    if (el.matches('[role=search], [action*=search], [class*=search]') || (fields.length === 1 && fields[0].matches('[type=search], [name=q], [name=s], [name=search], [name=query]'))) continue;
    const rect = visible(el);
    if (!rect) continue;
    const top = rect.top + window.scrollY;
    if (formTop === null || top < formTop) formTop = top;
    if (inFold(rect)) marks.push({ kind: "form", label: "Форма", box: box(rect) });
  }
  for (const el of Array.from(document.querySelectorAll("img, div, section, span, p")).slice(0, 4000)) {
    const text = (el.textContent || "").trim();
    if (text.length > 80 || !/отзыв|гарант|лет на рынке|сертифик|рейтинг|★/i.test(text)) continue;
    const rect = visible(el);
    if (rect && inFold(rect) && rect.height < vh / 3) {
      marks.push({ kind: "trust", label: text.slice(0, 50), box: box(rect) });
      break;
    }
  }

  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let length = 0;
  while (walker.nextNode() && length < 1500) {
    const node = walker.currentNode;
    const value = (node.textContent || "").replace(/\s+/g, " ").trim();
    if (value.length < 2 || !node.parentElement) continue;
    const rect = visible(node.parentElement);
    if (!rect || !inFold(rect)) continue;
    texts.push(value);
    length += value.length;
  }

  const interactive = Array.from(document.querySelectorAll("a, button, input, select, textarea")).map(visible).filter(Boolean);
  const small = interactive.filter((rect) => rect.height < 32 && rect.width < 120).length;
  const sizes = Array.from(document.querySelectorAll("p, li"))
    .slice(0, 200)
    .map((el) => parseFloat(getComputedStyle(el).fontSize))
    .filter((size) => size > 0)
    .sort((a, b) => a - b);

  return {
    marks,
    ctaAboveFold: marks.some((mark) => mark.kind === "cta" || mark.kind === "form"),
    phoneAboveFold: marks.some((mark) => mark.kind === "phone"),
    formAboveFold: marks.some((mark) => mark.kind === "form"),
    formDepthScreens: formTop === null ? null : Math.round((formTop / vh) * 10) / 10,
    horizontalScroll: document.documentElement.scrollWidth > vw + 4,
    baseFontPx: sizes.length ? sizes[Math.floor(sizes.length / 2)] : null,
    smallTapShare: interactive.length ? Math.round((small / interactive.length) * 100) / 100 : null,
    foldText: texts.join(" ").slice(0, 1500),
  };
}`;

// Ссылки с настоящим href не нажимаются, чтобы не уйти со страницы.
const DISMISS = String.raw`function dismiss(mode) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const COOKIE = /cookie|куки|персональн|конфиденциальн/i;
  const CONSENT = /использ|соглас|продолжая|обработк|we use|accept|agree/i;
  const isDialog = (el) => el.getAttribute("role") === "dialog" || el.getAttribute("aria-modal") === "true" || el.tagName === "DIALOG";
  const CITY = /ваш город|ваш регион|выберите (?:ваш )?город|это ваш город|угадали (?:город|регион)|город определ/i;
  const ACCEPT = /^(?:принять(?: все| и закрыть)?|принимаю|(?:я )?согласен|(?:я )?согласна|соглашаюсь|согласиться|понятно|хорошо|ок|ok|окей|accept(?: all)?|agree|got it|allow(?: all)?|разрешить|продолжить|закрыть)$/i;
  const CONFIRM = /^(?:да|да,? верно|верно|всё верно|все верно|да,? всё верно|правильно|подтвердить|угадали|ок|ok)$/i;
  const CLOSE = /^(?:×|✕|✖|x|закрыть|не сейчас|нет,? спасибо|позже|спасибо,? не надо|остаться в браузере|продолжить в браузере|close|no,? thanks)$/i;
  const found = [];
  const shown = (el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4 || rect.bottom <= 0 || rect.right <= 0 || rect.top >= vh || rect.left >= vw) return null;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) < 0.1) return null;
    return rect;
  };
  const textOf = (el) => (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  const labelOf = (el) => (textOf(el) || el.getAttribute("aria-label") || el.getAttribute("title") || el.value || "").trim();
  const clickable = (el) => {
    if (el.tagName === "A") {
      const href = (el.getAttribute("href") || "").trim();
      return !href || href === "#" || href.startsWith("javascript:");
    }
    return true;
  };
  const note = (kind, el) => {
    if (!found.some((item) => item.kind === kind)) found.push({ kind, label: textOf(el).slice(0, 80) });
  };
  const hide = (el, kind) => {
    el.style.setProperty("display", "none", "important");
    note(kind, el);
  };
  const press = (box, re, kind) => {
    for (const el of Array.from(box.querySelectorAll('button, [role=button], a, input[type=button], input[type=submit], [class*=close], [aria-label]'))) {
      if (!shown(el) || !clickable(el)) continue;
      const label = labelOf(el);
      const aria = (el.getAttribute("aria-label") || "") + " " + (typeof el.className === "string" ? el.className : "");
      if (re.test(label) || (re === CLOSE && !label && /close|закры/i.test(aria))) {
        el.click();
        note(kind, box);
        return true;
      }
    }
    return false;
  };
  const anchored = (el) => {
    for (let node = el, depth = 0; node && node !== document.body && depth < 8; node = node.parentElement, depth++) {
      const style = getComputedStyle(node);
      if (style.position === "fixed" || style.position === "absolute" || isDialog(node)) return node;
    }
    return null;
  };

  const floating = (el) => {
    for (let node = el, depth = 0; node && node !== document.body && depth < 8; node = node.parentElement, depth++) {
      const position = getComputedStyle(node).position;
      if (position === "fixed" || position === "sticky" || isDialog(node)) return true;
    }
    return false;
  };

  const all = Array.from(document.body.querySelectorAll("*")).slice(0, 30000);
  const overlays = [];
  // Большие sticky-блоки только закрываем кнопкой: в них часто живёт и меню сайта.
  const stickies = [];
  for (const el of all) {
    const style = getComputedStyle(el);
    const dialog = isDialog(el);
    const sticky = style.position === "sticky";
    if (style.position !== "fixed" && !sticky && !dialog) continue;
    if (style.pointerEvents === "none") continue;
    const rect = shown(el);
    if (!rect) continue;
    const z = parseInt(style.zIndex, 10);
    if ((rect.width * rect.height) / (vw * vh) < 0.25 || !(dialog || z >= 1)) continue;
    overlays.push(el);
    if (sticky && !dialog) stickies.push(el);
  }
  const cityBoxes = [];
  const cookieBars = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const el = walker.currentNode.parentElement;
    const value = walker.currentNode.textContent || "";
    if (!el || el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
    if (CITY.test(value) && shown(el)) {
      const box = anchored(el);
      if (box && !cityBoxes.includes(box) && textOf(box).length < 300 && shown(box)) cityBoxes.push(box);
    }
    if (COOKIE.test(value) && shown(el)) {
      // Поднимаемся до самой плашки, не захватывая соседние блоки (меню, футер).
      let node = el;
      let bar = el;
      while (node.parentElement && node.parentElement !== document.body) {
        const length = textOf(node).length;
        const parentLength = textOf(node.parentElement).length;
        if (parentLength > length * 1.2 + 30 || parentLength > 1200) break;
        node = node.parentElement;
        if (shown(node)) bar = node;
      }
      const text = textOf(bar);
      const rect = shown(bar);
      const ok =
        rect &&
        !cookieBars.includes(bar) &&
        CONSENT.test(text) &&
        text.length < 1200 &&
        (rect.width * rect.height) / (vw * vh) < 0.6 &&
        !bar.closest("form") &&
        !overlays.some((overlay) => overlay.contains(bar)) &&
        floating(bar);
      if (ok) cookieBars.push(bar);
    }
  }
  const overlayKind = (el) => {
    const text = textOf(el);
    return /cookie|куки/i.test(text) && text.length < 1200 ? "cookies" : "modal";
  };

  if (mode === "click") {
    for (const box of cityBoxes) press(box, CONFIRM, "city");
    for (const bar of cookieBars) press(bar, ACCEPT, "cookies");
    for (const el of overlays) {
      const kind = overlayKind(el);
      press(el, kind === "cookies" ? ACCEPT : CLOSE, kind);
    }
    return found;
  }

  for (const box of cityBoxes) hide(box, "city");
  for (const bar of cookieBars) hide(bar, "cookies");
  for (const el of overlays) if (!stickies.includes(el) && shown(el)) hide(el, overlayKind(el));
  for (const root of [document.documentElement, document.body]) {
    if (getComputedStyle(root).overflowY === "hidden") root.style.setProperty("overflow", "visible", "important");
  }
  return found;
}`;

const PERF_SCRIPT = String.raw`(() => {
  const nav = performance.getEntriesByType("navigation")[0];
  const fcp = performance.getEntriesByName("first-contentful-paint")[0];
  const dg = window.__dg;
  return {
    ttfb: nav ? nav.responseStart - nav.startTime : null,
    load: nav && nav.loadEventEnd > 0 ? nav.loadEventEnd - nav.startTime : null,
    fcp: fcp ? fcp.startTime : null,
    lcp: dg && dg.lcp != null ? dg.lcp : null,
    cls: dg ? dg.cls : null,
  };
})()`;

export async function openPage(context: BrowserContext, url: string) {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
  } catch (error) {
    if (!page.url() || page.url() === "about:blank") throw error;
  }
  await page.waitForTimeout(1500);
  return page;
}

export async function clearPopups(page: Page): Promise<ViewPopup[]> {
  const url = page.url();
  const found: ViewPopup[] = [];
  const merge = (items: ViewPopup[]) => {
    for (const item of items) if (!found.some((known) => known.kind === item.kind)) found.push(item);
  };
  try {
    // Повторные проходы ловят окна, которые сайт показывает по таймеру через 2–5 секунд.
    for (const pause of [0, 1500, 2000]) {
      await page.waitForTimeout(pause);
      const clicked = (await page.evaluate(`(${DISMISS})("click")`)) as ViewPopup[];
      merge(clicked);
      if (clicked.length) await page.waitForTimeout(700);
      if (page.url() !== url) {
        await page.goto(url, { waitUntil: "load", timeout: 30_000 }).catch(() => undefined);
        await page.waitForTimeout(1500);
      }
      merge((await page.evaluate(`(${DISMISS})("hide")`)) as ViewPopup[]);
    }
    if (found.length) await page.waitForTimeout(300);
  } catch (error) {
    console.error("[diagnost] popups", error instanceof Error ? error.message : error);
  }
  return found;
}

export async function renderSite(url: string, auditId: string): Promise<RenderSignals> {
  let browser: Browser | null = null;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });

    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: CHROME_UA, locale: "ru-RU" });
    await guard(desktopContext);
    await desktopContext.addInitScript(OBSERVERS);
    let requests = 0;
    const kb: Record<string, number> = { script: 0, stylesheet: 0, image: 0, font: 0, total: 0 };
    desktopContext.on("requestfinished", async (request) => {
      requests++;
      try {
        const sizes = await request.sizes();
        const bytes = sizes.responseBodySize + sizes.responseHeadersSize;
        kb.total += bytes;
        const type = request.resourceType();
        if (type in kb) kb[type] += bytes;
      } catch {
        /* запрос закрыт до замера */
      }
    });
    const desktopPage = await openPage(desktopContext, url);
    const perfRaw = (await desktopPage.evaluate(PERF_SCRIPT)) as {
      ttfb: number | null;
      load: number | null;
      fcp: number | null;
      lcp: number | null;
      cls: number | null;
    };
    const desktopPopups = await clearPopups(desktopPage);
    const desktopFold = (await desktopPage.evaluate(`(${COLLECT_FOLD})(${JSON.stringify(STRONG_CTA_SOURCE)})`)) as FoldData;
    const desktopShot = shotPath(auditId, "desktop");
    await desktopPage.screenshot({ path: desktopShot, type: "jpeg", quality: 78 });
    const html = await desktopPage.content().catch(() => null);
    const kbOf = (bytes: number) => Math.round(bytes / 1024);
    const perf: PerfSignals = {
      ttfbMs: perfRaw.ttfb !== null ? Math.round(perfRaw.ttfb) : null,
      fcpMs: perfRaw.fcp !== null ? Math.round(perfRaw.fcp) : null,
      lcpMs: perfRaw.lcp !== null ? Math.round(perfRaw.lcp) : null,
      cls: perfRaw.cls !== null ? Math.round(perfRaw.cls * 1000) / 1000 : null,
      loadMs: perfRaw.load !== null ? Math.round(perfRaw.load) : null,
      requests,
      transferKb: kbOf(kb.total),
      jsKb: kbOf(kb.script),
      cssKb: kbOf(kb.stylesheet),
      imgKb: kbOf(kb.image),
      fontKb: kbOf(kb.font),
    };
    await desktopContext.close();

    let mobile: ViewSignals | null = null;
    try {
      const mobileContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: MOBILE_UA,
        locale: "ru-RU",
      });
      await guard(mobileContext);
      const mobilePage = await openPage(mobileContext, url);
      const mobilePopups = await clearPopups(mobilePage);
      const mobileFold = (await mobilePage.evaluate(`(${COLLECT_FOLD})(${JSON.stringify(STRONG_CTA_SOURCE)})`)) as FoldData;
      const mobileShot = shotPath(auditId, "mobile");
      await mobilePage.screenshot({ path: mobileShot, type: "jpeg", quality: 70 });
      mobile = { ...mobileFold, popups: mobilePopups, shot: mobileShot, width: 390, height: 844 };
      await mobileContext.close();
    } catch (error) {
      console.error("[diagnost] mobile", error instanceof Error ? error.message : error);
    }

    return {
      ok: true,
      error: null,
      desktop: { ...desktopFold, popups: desktopPopups, shot: desktopShot, width: 1440, height: 900 },
      mobile,
      perf,
      html,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message.split("\n")[0].slice(0, 300) : "Браузер не открыл сайт",
      desktop: null,
      mobile: null,
      perf: null,
      html: null,
    };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

export type { FoldMark };
