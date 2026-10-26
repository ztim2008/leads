// Скрипты, которые выполняются внутри проверяемой страницы (page.evaluate).
// Строками, а не функциями — tsx/esbuild иначе вставляет хелперы (__name), которых нет в браузере.

/** Прокрутка до низа и обратно — догружает lazy-картинки и блоки «появления при скролле». */
export const SCROLL_THROUGH = String.raw`async (maxHeight) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const step = Math.max(300, Math.round(window.innerHeight * 0.8));
  for (let y = 0; y < Math.min(document.documentElement.scrollHeight, maxHeight); y += step) {
    window.scrollTo(0, y);
    await wait(220);
  }
  window.scrollTo(0, 0);
  await wait(700);
}`;

/** sticky → relative: на нулевой прокрутке вёрстка та же, но при съёмке кусками блок не повторяется. */
export const FLATTEN_STICKY = String.raw`() => {
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    if (getComputedStyle(el).position === "sticky") el.style.setProperty("position", "relative", "important");
  }
}`;

/** Фиксированные элементы видны только на первом куске снимка. */
export const TOGGLE_FIXED = String.raw`(hide) => {
  if (hide) {
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      if (getComputedStyle(el).position === "fixed" && getComputedStyle(el).visibility !== "hidden") el.setAttribute("data-rg-fixed", "1");
    }
    // transition на visibility откладывает скрытие до конца анимации — и у самого блока, и у детей
    const style = document.createElement("style");
    style.id = "rg-fixed-style";
    style.textContent = "[data-rg-fixed],[data-rg-fixed] *{transition:none!important;animation:none!important;visibility:hidden!important}";
    document.head.appendChild(style);
  } else {
    document.getElementById("rg-fixed-style")?.remove();
    for (const el of Array.from(document.querySelectorAll("[data-rg-fixed]"))) el.removeAttribute("data-rg-fixed");
  }
}`;

export const SCROLL_TO = String.raw`async (y) => {
  window.scrollTo(0, y);
  await new Promise((r) => setTimeout(r, 250));
  return Math.round(window.scrollY);
}`;

/** Сбор ссылок, кнопок и «похожих на кнопку» элементов с координатами в px документа. */
export const COLLECT_CLICKS = String.raw`(maxHeight) => {
  const INTERACTIVE = 'a, button, input[type=submit], input[type=button], input[type=image], [role=button], [role=link], [onclick]';
  const vw = document.documentElement.clientWidth;
  const docHeight = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  const limitY = Math.min(docHeight, maxHeight);
  const textOf = (el) => (el.innerText || "").replace(/\s+/g, " ").trim();
  const labelOf = (el) => {
    const img = el.querySelector && el.querySelector("img[alt]");
    return (textOf(el) || el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("value") || el.getAttribute("alt") || (img ? img.getAttribute("alt") : "") || "").trim().slice(0, 80);
  };
  const pathOf = (el) => {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body && node !== document.documentElement) {
      let i = 1;
      let sib = node;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === node.tagName) i++;
      parts.unshift(node.tagName.toLowerCase() + ":nth-of-type(" + i + ")");
      node = node.parentElement;
    }
    return "body > " + parts.join(" > ");
  };
  const boxOf = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) < 0.1) return null;
    const x = r.left + window.scrollX;
    const y = r.top + window.scrollY;
    if (x + r.width <= 1 || x >= vw - 1 || y >= limitY || y + r.height <= 0) return null;
    // Предки: прозрачность и схлопнутые блоки с overflow (свёрнутые меню, аккордеоны)
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (Number(ps.opacity) < 0.1) return null;
      if (ps.overflowX !== "visible" || ps.overflowY !== "visible") {
        const pr = p.getBoundingClientRect();
        const ix = Math.max(0, Math.min(r.right, pr.right) - Math.max(r.left, pr.left));
        const iy = Math.max(0, Math.min(r.bottom, pr.bottom) - Math.max(r.top, pr.top));
        if (ix * iy < r.width * r.height * 0.3) return null;
      }
    }
    return { x: Math.round(x), y: Math.round(y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const bgOf = (el) => {
    for (let p = el; p; p = p.parentElement) {
      const c = getComputedStyle(p).backgroundColor;
      if (c && c !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(c)) return c;
    }
    return "rgb(255, 255, 255)";
  };
  const buttonish = (el, box) => {
    const text = textOf(el);
    if (!text || text.length > 40 || box.h < 22 || box.h > 96 || box.w > 520) return false;
    if (el.querySelector(INTERACTIVE)) return false;
    const s = getComputedStyle(el);
    if (/(^|[\s_-])(btn|button|knopka)([\s_-]|$)/i.test(el.className && el.className.baseVal === undefined ? el.className : "")) return true;
    const own = s.backgroundColor;
    const filled = own && own !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(own) && el.parentElement && own !== bgOf(el.parentElement);
    const bordered = parseFloat(s.borderTopWidth) >= 1 && s.borderTopStyle !== "none" && parseFloat(s.borderTopLeftRadius) >= 3;
    const padded = parseFloat(s.paddingLeft) >= 8 && parseFloat(s.paddingTop) >= 4;
    return Boolean((filled || bordered) && padded);
  };
  const inlineText = (el) => {
    if (getComputedStyle(el).display !== "inline") return false;
    const parent = el.parentElement;
    return Boolean(parent && textOf(parent).length > textOf(el).length + 20);
  };

  const hasSubmenu = (el) => {
    if (el.hasAttribute("aria-haspopup") || el.hasAttribute("aria-expanded")) return true;
    const host = el.closest("li") || el.parentElement;
    if (!host) return false;
    return Array.from(host.querySelectorAll('ul, ol, [class*="sub"], [class*="drop"], [class*="menu"]')).some((n) => n !== el && !n.contains(el) && !el.contains(n));
  };

  let framework = null;
  if (window.__NEXT_DATA__ || window.next || document.querySelector("[data-reactroot], #__next")) framework = "react";
  else if (window.__VUE__ || document.querySelector("[data-v-app], [data-server-rendered]")) framework = "vue";
  else if (document.querySelector("[ng-version]")) framework = "angular";
  if (!framework) {
    const sample = Array.from(document.querySelectorAll("body *")).slice(0, 300);
    if (sample.some((el) => Object.keys(el).some((k) => k.startsWith("__react")))) framework = "react";
    else if (sample.some((el) => el.__vue__ || el.__vueParentComponent)) framework = "vue";
  }

  const items = [];
  const seen = new Set();
  const push = (el, interactive, box, isButtonish) => {
    const path = pathOf(el);
    if (seen.has(path)) return;
    seen.add(path);
    const hrefRaw = el.tagName === "A" ? el.getAttribute("href") : null;
    let anchorExists = null;
    if (hrefRaw && /^#[^!/]/.test(hrefRaw.trim())) {
      const id = decodeURIComponent(hrefRaw.trim().slice(1));
      anchorExists = Boolean(document.getElementById(id) || document.getElementsByName(id).length);
    }
    const type = (el.getAttribute("type") || "").toLowerCase();
    const cls = typeof el.className === "string" ? el.className.trim().replace(/\s+/g, " ").slice(0, 80) : "";
    items.push({
      path,
      sig: el.tagName + "|" + cls + "|" + labelOf(el).slice(0, 40),
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role"),
      label: labelOf(el),
      hrefRaw,
      hrefAbs: el.tagName === "A" && el.href ? String(el.href) : null,
      box,
      inForm: Boolean(el.closest("form")),
      formAttr: el.hasAttribute("form"),
      submit: el.tagName === "BUTTON" ? type === "" || type === "submit" : type === "submit" || type === "image",
      interactive,
      buttonish: isButtonish,
      pointer: getComputedStyle(el).cursor === "pointer",
      inlineText: inlineText(el),
      onclick: el.hasAttribute("onclick"),
      submenu: hasSubmenu(el),
      active: el.getAttribute("aria-selected") === "true" || el.getAttribute("aria-pressed") === "true" || el.hasAttribute("aria-current") || /(^|[\s_-])(active|selected|current|is-active)([\s_-]|$)/i.test(cls),
      anchorExists,
    });
  };

  const MAPS = '[class*="ymaps"], .gm-style, .leaflet-container';
  for (const el of Array.from(document.querySelectorAll(INTERACTIVE))) {
    if (el.parentElement && el.parentElement.closest(INTERACTIVE)) continue;
    if (el.closest(MAPS)) continue;
    const box = boxOf(el);
    if (box) push(el, true, box, false);
    if (items.length >= 300) break;
  }

  // Не-интерактивные элементы, которые выглядят как кнопка: верхний элемент с cursor:pointer или класс btn/button
  const fakes = [];
  for (const el of Array.from(document.querySelectorAll("body div, body span, body li, body p, body label, body img, body svg"))) {
    if (el.closest(INTERACTIVE) || el.closest("label, form select")) continue;
    const s = getComputedStyle(el);
    const parentPointer = el.parentElement && getComputedStyle(el.parentElement).cursor === "pointer";
    const cls = typeof el.className === "string" ? el.className : "";
    const pointerTop = s.cursor === "pointer" && !parentPointer;
    if (!pointerTop && !/(^|[\s_-])(btn|button)([\s_-]|$)/i.test(cls)) continue;
    const box = boxOf(el);
    if (!box) continue;
    if (!buttonish(el, box)) continue;
    fakes.push([el, box]);
    if (fakes.length >= 80) break;
  }
  for (const [el, box] of fakes) {
    if (fakes.some(([other]) => other !== el && other.contains(el))) continue;
    push(el, false, box, true);
  }

  return { items, docHeight, framework };
}`;

/** Пробный клик, шаг 1: наблюдатель DOM, фоновый шум за 300 мс, перехват буфера обмена и window.open. */
export const PROBE_ARM = String.raw`async (path) => {
  const el = document.querySelector(path);
  if (!el) return { missing: true, base: 0 };
  const state = { count: 0, side: false, before: location.href, mo: null };
  state.mo = new MutationObserver((list) => { state.count += list.length; });
  state.mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  if (!window.__rgPatched) {
    window.__rgPatched = true;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      const write = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = (t) => { if (window.__rg) window.__rg.side = true; return write(t).catch(() => undefined); };
    }
    const exec = document.execCommand.bind(document);
    document.execCommand = (...args) => { if (window.__rg) window.__rg.side = true; return exec(...args); };
    window.open = () => { if (window.__rg) window.__rg.side = true; return null; };
  }
  window.__rg = state;
  await new Promise((r) => setTimeout(r, 300));
  const base = state.count;
  state.count = 0;
  return { missing: false, base };
}`;

/** Запасной клик событиями — если настоящий клик Playwright не прошёл (элемент перекрыт). */
export const PROBE_DISPATCH = String.raw`(path) => {
  const el = document.querySelector(path);
  if (!el) return;
  const r = el.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  try {
    el.dispatchEvent(new PointerEvent("pointerdown", at));
    el.dispatchEvent(new MouseEvent("mousedown", at));
    el.dispatchEvent(new PointerEvent("pointerup", at));
    el.dispatchEvent(new MouseEvent("mouseup", at));
    el.click();
  } catch (e) {}
}`;

/** Пробный клик, шаг 3: реакция за 650 мс. */
export const PROBE_READ = String.raw`async () => {
  const state = window.__rg;
  if (!state) return { after: 0, moved: true };
  await new Promise((r) => setTimeout(r, 650));
  state.mo.disconnect();
  window.__rg = null;
  return { after: state.count, moved: location.href !== state.before || state.side };
}`;
