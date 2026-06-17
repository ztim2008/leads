import { db } from "../src/lib/db";

async function main() {
  const source = await db.source.findFirst({ where: { platform: "profi" } });
  if (!source) { console.log("Нет источника"); process.exit(1); }
  const config = source.config as Record<string, unknown>;
  const cookieStr = (config.cookies as string) || "";

  const headers = {
    "Cookie": cookieStr,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, */*",
  };

  // Next.js _next/data эндпоинты
  const urls = [
    "https://profi.ru/_next/data/build-id-xxx/cabinet/orders.json",
    "https://profi.ru/cabinet/orders/?__nextDataReq=1",
  ];

  // Пробуем найти buildId из HTML
  const pageRes = await fetch("https://profi.ru/cabinet/orders/", { headers: {
    ...headers, "Accept": "text/html"
  }, signal: AbortSignal.timeout(10000) });
  const html = await pageRes.text();
  const buildMatch = html.match(/"buildId"\s*:\s*"([^"]+)"/);
  if (buildMatch) {
    const buildId = buildMatch[1];
    console.log("BuildId:", buildId);
    const nextDataUrl = `https://profi.ru/_next/data/${buildId}/cabinet/orders.json`;
    console.log("Пробую:", nextDataUrl);
    try {
      const ndRes = await fetch(nextDataUrl, { headers, signal: AbortSignal.timeout(10000) });
      const ndText = await ndRes.text();
      console.log("Статус:", ndRes.status, "Длина:", ndText.length);
      console.log(ndText.slice(0, 500));
    } catch (e) {
      console.log("Ошибка:", e);
    }
  } else {
    console.log("BuildId не найден в HTML");
  }

  process.exit(0);
}
main();
