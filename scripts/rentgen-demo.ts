/**
 * Рентген: пример для стартовой страницы /rentgen — снимок первого экрана демо-страницы с рамками.
 * npx tsx scripts/rentgen-demo.ts [url] [slug полного отчёта]
 * По умолчанию — public/rentgen/demo-site.html, где ошибки заложены специально.
 * Пишет public/rentgen/demo.jpg и src/lib/rentgen/demo.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { renderRentgen } from "@/lib/rentgen/render";

const CROP = 1100;

async function main() {
  const url = process.argv[2] || "https://leads.konversus.ru/rentgen/demo-site.html";
  const report = process.argv[3] ? `/rentgen/r/${process.argv[3]}` : null;
  const result = await renderRentgen(url, "demo");
  const view = result.views.desktop;
  const height = Math.min(CROP, view.height);
  const outDir = join(process.cwd(), "public", "rentgen");
  mkdirSync(outDir, { recursive: true });
  await sharp(view.shot)
    .extract({ left: 0, top: 0, width: view.width, height })
    .resize({ width: 960 })
    .jpeg({ quality: 72, mozjpeg: true })
    .toFile(join(outDir, "demo.jpg"));
  const items = view.items
    .filter((item) => item.box.y + item.box.h <= height)
    .map(({ path: _path, ...item }) => item);
  const demo = { host: new URL(url).hostname, report, width: view.width, height, shot: "/rentgen/demo.jpg", items };
  writeFileSync(join(process.cwd(), "src", "lib", "rentgen", "demo.json"), JSON.stringify(demo, null, 1));
  const count = (kind: string) => items.filter((item) => item.kind === kind).length;
  console.log(`demo: ${items.length} элементов · ok ${count("ok")} · dead ${count("dead")} · fake ${count("fake")} · small ${count("small")} · unknown ${count("unknown")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
