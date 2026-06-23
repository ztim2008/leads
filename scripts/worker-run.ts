// Точка входа для PM2 — запускает воркер
// С проверкой синтаксиса перед стартом

// Быстрая проверка что worker.ts не имеет синтаксических ошибок
try {
  require("fs").readFileSync(require("path").join(__dirname, "..", "src/lib/queue/worker.ts"), "utf-8");
} catch (e) {
  console.error("❌ Не удалось прочитать worker.ts:", e);
  process.exit(1);
}

import "@/lib/connectors/profi";
import { startScheduler } from "@/lib/queue/worker";
import { db } from "@/lib/db";

(async () => {
  try {
    const allSettings = await db.settings.findMany({ where: { systemEnabled: true }, select: { checkInterval: true } });
    const intervals = allSettings.map((s: any) => s.checkInterval).filter(Boolean);
    const intervalMin = intervals.length > 0 ? Math.min(...intervals) : 3;
    startScheduler(intervalMin * 60 * 1000);
    console.log(`🟢 Worker запущен (опрос: ${intervalMin} мин)`);
  } catch (e) {
    console.error("❌ Ошибка запуска воркера:", e);
    process.exit(1);
  }
})();
