import { db } from "../src/lib/db";

async function main() {
  const source = await db.source.findFirst({ where: { platform: "profi" } });
  if (!source) { console.log("Нет источника"); process.exit(1); }
  const config = source.config as Record<string, unknown>;
  const cookieStr = (config.cookies as string) || "";

  const headers = {
    "Cookie": cookieStr,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };

  // Пробуем разные API-эндпоинты
  const apis = [
    "https://profi.ru/api/cabinet/orders/",
    "https://profi.ru/api/orders/",
    "https://profi.ru/api/v1/orders/",
    "https://profi.ru/api/cabinet/orders/list/",
    "https://profi.ru/cabinet/api/orders/",
    "https://profi.ru/api/graphql",
  ];

  for (const api of apis) {
    try {
      const res = await fetch(api, { headers, signal: AbortSignal.timeout(10000) });
      const text = await res.text();
      const preview = text.slice(0, 120);
      console.log(`${res.status} ${api} → ${preview}`);
      if (text.includes("orders") || text.includes("tasks") || text.includes("items")) {
        console.log("  🔥 ВОЗМОЖНО НАШЛИ!");
        console.log("  ", text.slice(0, 500));
      }
    } catch (e) {
      console.log(`❌ ${api} → ${e}`);
    }
  }

  process.exit(0);
}
main();
