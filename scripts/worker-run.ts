// Отдельный процесс BullMQ Worker для PM2
// Запуск: npx tsx scripts/worker-run.ts

// Регистрируем коннекторы
import "@/lib/connectors/profi";

// Импортируем worker (автозапуск)
import { worker } from "@/lib/queue/worker";

console.log("🚀 BullMQ Worker запущен");
console.log("📋 Ожидание заданий из очереди leads-processing...");

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("⏳ Завершение worker...");
  await worker.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("⏳ Завершение worker...");
  await worker.close();
  process.exit(0);
});
