/**
 * Рентген: прогон сбора «Кликов» на сайтах без БД + картинки с рамками для глазной проверки.
 * npx tsx scripts/rentgen-probe.ts https://site1.ru https://site2.ru
 * Результат: /tmp/rentgen-probe/<host>-<view>.jpg и сводка в консоли.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderRentgen } from "@/lib/rentgen/render";
import type { ClickKind, RentgenView } from "@/lib/rentgen/types";

const OUT = "/tmp/rentgen-probe";
const COLORS: Record<ClickKind, string> = { ok: "#22c55e", dead: "#ef4444", fake: "#f59e0b", small: "#f59e0b", unknown: "#a1a1aa" };

async function annotate(view: RentgenView, file: string) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: view.width, height: 900 } });
  const img = readFileSync(view.shot).toString("base64");
  const boxes = view.items
    .map(
      (item) =>
        `<div style="position:absolute;left:${item.box.x}px;top:${item.box.y}px;width:${item.box.w}px;height:${item.box.h}px;outline:2px solid ${COLORS[item.kind]};background:${COLORS[item.kind]}22">${
          item.n ? `<b style="position:absolute;left:-2px;top:-18px;background:${COLORS[item.kind]};color:#000;font:700 12px sans-serif;padding:1px 5px;border-radius:8px">${item.n}</b>` : ""
        }</div>`,
    )
    .join("");
  await page.setContent(
    `<body style="margin:0"><div style="position:relative;width:${view.width}px;height:${view.height}px"><img src="data:image/jpeg;base64,${img}" style="width:${view.width}px;height:${view.height}px;display:block">${boxes}</div></body>`,
  );
  await page.screenshot({ path: file, type: "jpeg", quality: 70, fullPage: true });
  await browser.close();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const url of process.argv.slice(2)) await probe(url);
}

async function probe(url: string) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  try {
    const result = await renderRentgen(url, `probe-${host.replace(/\./g, "-")}`);
    console.log(`\n=== ${host} · ${result.ms} мс · framework=${result.framework ?? "—"} · ссылок проверено ${result.linksChecked}`);
    for (const [name, view] of Object.entries(result.views)) {
      if (!view) {
        console.log(`  ${name}: нет`);
        continue;
      }
      const count = (kind: ClickKind) => view.items.filter((item) => item.kind === kind).length;
      console.log(
        `  ${name}: ${view.width}×${view.height}${view.truncated ? " (обрезано)" : ""} · всего ${view.items.length} · ok ${count("ok")} · dead ${count("dead")} · fake ${count("fake")} · small ${count("small")} · unknown ${count("unknown")} · не прощёлкано ${view.unprobed}`,
      );
      for (const item of view.items.filter((i) => i.n)) console.log(`    #${item.n} ${item.kind} «${item.label.slice(0, 40)}» — ${item.reason}${item.status ? ` [${item.status}]` : ""}${item.href ? ` (${item.href.slice(0, 60)})` : ""} @${item.box.x},${item.box.y} ${item.box.w}×${item.box.h} ${item.path.slice(-90)}`);
      await annotate(view, join(OUT, `${host}-${name}.jpg`));
    }
  } catch (error) {
    console.log(`\n=== ${host} · ОШИБКА: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
  }
}

main();
