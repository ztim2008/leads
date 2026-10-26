/**
 * Рентген: досчитать слой «Внимание» для готового скана (снимки уже на диске).
 * npx tsx scripts/rentgen-attention.ts <slug>          — только показать
 * npx tsx scripts/rentgen-attention.ts <slug> --save   — записать в скан
 */
import { db } from "@/lib/db";
import { addAttention } from "@/lib/rentgen/render";
import type { RentgenResult } from "@/lib/rentgen/types";

async function main() {
  const [slug, flag] = process.argv.slice(2);
  if (!slug) throw new Error("Укажите slug скана");
  const scan = await db.rentgenScan.findUnique({ where: { slug } });
  if (!scan || scan.status !== "done" || !scan.result) throw new Error("Скан не найден или не готов");
  const result = scan.result as unknown as RentgenResult;
  const started = Date.now();
  await addAttention(scan.id, result.views.desktop, result.views.mobile);
  console.log(`${scan.host}: ${Date.now() - started} мс`);
  for (const [kind, view] of Object.entries(result.views)) {
    const attention = view?.attention;
    if (!attention) {
      console.log(kind, "— без слоя");
      continue;
    }
    console.log(`${kind}: собранность ${Math.round(attention.focus * 100)}%, карта ${attention.map}`);
    for (const item of attention.items) console.log(`  ${(item.share * 100).toFixed(1).padStart(5)}%  ×${item.lift}  ${item.label}`);
  }
  if (flag === "--save") {
    await db.rentgenScan.update({ where: { id: scan.id }, data: { result: result as object } });
    console.log("записано");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
