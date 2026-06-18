// Точка входа для PM2 — запускает воркер
import "@/lib/connectors/profi";
import { startScheduler } from "@/lib/queue/worker";
import { db } from "@/lib/db";

(async () => {
  const s = await db.settings.findFirst();
  const intervalMin = s?.checkInterval || 3;
  startScheduler(intervalMin * 60 * 1000);
  console.log(`🟢 Worker запущен (опрос: ${intervalMin} мин)`);
})();
