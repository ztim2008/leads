// Точка входа для PM2 — запускает воркер
import "@/lib/connectors/profi";
import { startScheduler } from "@/lib/queue/worker";
import { db } from "@/lib/db";

(async () => {
  const allSettings = await db.settings.findMany({ where: { systemEnabled: true }, select: { checkInterval: true } });
  const intervals = allSettings.map((s: any) => s.checkInterval).filter(Boolean);
  const intervalMin = intervals.length > 0 ? Math.min(...intervals) : 3;
  startScheduler(intervalMin * 60 * 1000);
  console.log(`🟢 Worker запущен (опрос: ${intervalMin} мин)`);
})();
