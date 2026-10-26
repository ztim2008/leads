import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "playwright";
import type { IssueItem, IssueRule, PxBox, ViewKind } from "@/lib/rentgen/types";

let axeSource: string | null = null;

const AXE_RULES = ["color-contrast", "label", "select-name", "image-alt", "input-image-alt", "button-name", "link-name"];

type RawIssue = { rule: string; label: string; box: PxBox; data?: { ratio?: number; expected?: number; px?: number } };

/** В странице: axe по выбранным правилам + свои проверки телефона. Координаты — px документа. */
const COLLECT_ISSUES = String.raw`async (opts) => {
  const out = [];
  const boxOf = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) return null;
    const y = Math.round(r.top + scrollY);
    if (y > opts.maxHeight) return null;
    return { x: Math.max(0, Math.round(r.left + scrollX)), y, w: Math.round(r.width), h: Math.round(r.height) };
  };
  const fileOf = (src) => (src || "").split(/[?#]/)[0].split("/").pop().slice(0, 60);
  const labelOf = (el) => {
    const text = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("name") || "").replace(/\s+/g, " ").trim();
    if (text) return text.slice(0, 80);
    const img = el.tagName === "IMG" ? el : el.querySelector("img");
    if (img) {
      const file = fileOf(img.currentSrc || img.getAttribute("src"));
      // Хэш вместо имени файла посетителю ничего не скажет
      return /^[0-9a-f-]{16,}\.|^.{41,}$/i.test(file) || !file ? "Картинка" : "Картинка " + file;
    }
    if (el.querySelector("svg")) return "Иконка";
    return "";
  };
  const perRule = {};
  const push = (rule, el, data, limit) => {
    perRule[rule] = perRule[rule] || 0;
    if (perRule[rule] >= limit) return;
    const box = boxOf(el);
    if (!box) return;
    perRule[rule] += 1;
    out.push({ rule, label: labelOf(el), box, data });
  };

  try {
    const res = await window.axe.run(document, { runOnly: { type: "rule", values: opts.rules }, resultTypes: ["violations"] });
    for (const violation of res.violations) {
      for (const node of violation.nodes) {
        const target = node.target && node.target[0];
        if (typeof target !== "string") continue;
        let el = null;
        try { el = document.querySelector(target); } catch { el = null; }
        if (!el) continue;
        let data;
        if (violation.id === "color-contrast") {
          const d = (node.any && node.any[0] && node.any[0].data) || {};
          if (!d.contrastRatio) continue;
          data = { ratio: d.contrastRatio, expected: Number(String(d.expectedContrastRatio || "4.5").replace(":1", "")) };
        }
        push(violation.id, el, data, violation.id === "color-contrast" ? 60 : 30);
      }
    }
  } catch (e) {
    out.push({ rule: "__error", label: String(e && e.message || e).slice(0, 200), box: { x: 0, y: 0, w: 0, h: 0 } });
  }

  if (opts.mobile) {
    const vw = document.documentElement.clientWidth;
    // В режиме телефона Chromium растягивает окно раскладки под широкий контент: scrollX остаётся 0, зато innerWidth > clientWidth
    window.scrollTo(100, scrollY);
    const scrolls = scrollX > 0 || innerWidth > vw + 1;
    window.scrollTo(0, scrollY);
    if (scrolls) {
      const wide = Array.from(document.querySelectorAll("body *")).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== "fixed";
      });
      const top = wide.filter((el) => !wide.includes(el.parentElement));
      for (const el of top) push("overflow", el, undefined, 10);
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || node.nodeValue.trim().length < 3) continue;
      const el = node.parentElement;
      if (!el || seen.has(el) || el.closest("[aria-hidden=true],script,style,noscript,svg")) continue;
      seen.add(el);
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px && px < 12) push("small-text", el, { px: Math.round(px * 10) / 10 }, 30);
    }
  }
  return out;
}`;

const RULE_OF: Record<string, IssueRule> = {
  "color-contrast": "contrast",
  label: "label",
  "select-name": "label",
  "image-alt": "alt",
  "input-image-alt": "alt",
  "button-name": "button-name",
  "link-name": "link-name",
  overflow: "overflow",
  "small-text": "small-text",
};

const fmt = (value: number) => String(Math.round(value * 10) / 10).replace(".", ",");

function describe(raw: RawIssue): Pick<IssueItem, "rule" | "severity" | "reason"> | null {
  const rule = RULE_OF[raw.rule];
  if (!rule) return null;
  switch (rule) {
    case "contrast": {
      const ratio = raw.data?.ratio ?? 0;
      return { rule, severity: ratio < 3 ? "error" : "warn", reason: `Текст плохо читается: контраст ${fmt(ratio)}:1, нужно от ${fmt(raw.data?.expected ?? 4.5)}:1` };
    }
    case "label":
      return { rule, severity: "error", reason: "Поле формы без подписи — непонятно, что вводить" };
    case "alt":
      return { rule, severity: "warn", reason: "Картинка без описания (alt) — её не видят поисковики и экранные дикторы" };
    case "button-name":
      return { rule, severity: "warn", reason: "Кнопка без названия — экранный диктор скажет просто «кнопка»" };
    case "link-name":
      return { rule, severity: "warn", reason: "Ссылка без текста — непонятно, куда ведёт" };
    case "overflow":
      return { rule, severity: "error", reason: "Блок шире экрана — страница ездит вбок" };
    case "small-text":
      return { rule, severity: "warn", reason: `Мелкий текст: ${fmt(raw.data?.px ?? 0)} px, на телефоне читать трудно (нужно от 12 px)` };
  }
}

const CAP: Partial<Record<IssueRule, number>> = { contrast: 25 };

function inside(inner: PxBox, outer: PxBox) {
  return inner.x >= outer.x - 2 && inner.y >= outer.y - 2 && inner.x + inner.w <= outer.x + outer.w + 2 && inner.y + inner.h <= outer.y + outer.h + 2;
}

/** Родитель и вложенный элемент с одной находкой — оставляем внешний; картинка без alt внутри пустой ссылки — это одна проблема ссылки */
function dropNested(items: IssueItem[]): IssueItem[] {
  return items.filter(
    (item, index) =>
      !items.some(
        (other, j) =>
          j !== index &&
          inside(item.box, other.box) &&
          ((other.rule === item.rule && (!inside(other.box, item.box) || j < index)) || (item.rule === "alt" && other.rule === "link-name")),
      ),
  );
}

export async function collectIssues(page: Page, view: ViewKind, maxHeight: number): Promise<IssueItem[]> {
  axeSource ??= readFileSync(join(process.cwd(), "node_modules", "axe-core", "axe.min.js"), "utf8");
  await page.addScriptTag({ content: axeSource });
  const raw = (await page.evaluate(`(${COLLECT_ISSUES})(${JSON.stringify({ rules: AXE_RULES, mobile: view === "mobile", maxHeight })})`)) as RawIssue[];
  const failed = raw.find((item) => item.rule === "__error");
  if (failed) console.error("[rentgen] axe", failed.label);
  const items = raw
    .map((item) => {
      const meta = describe(item);
      return meta ? { n: 0, ...meta, label: item.label, box: item.box } : null;
    })
    .filter((item): item is IssueItem => item !== null);
  const seen: Partial<Record<IssueRule, number>> = {};
  return dropNested(items)
    .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)
    .filter((item) => {
      seen[item.rule] = (seen[item.rule] ?? 0) + 1;
      return seen[item.rule]! <= (CAP[item.rule] ?? Infinity);
    })
    .map((item, index) => ({ ...item, n: index + 1 }));
}
