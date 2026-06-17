// Точка входа для PM2 — запускает воркер с планировщиком
import "@/lib/connectors/profi";

// Импорт worker автоматически запускает startScheduler()
import "@/lib/queue/worker";

console.log("🟢 Worker с планировщиком запущен");
console.log("⏰ Опрос источников каждые 5 минут");
console.log("📋 Активные коннекторы: Profi.ru");
