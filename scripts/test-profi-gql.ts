import { db } from "../src/lib/db";

async function main() {
  const source = await db.source.findFirst({ where: { platform: "profi" } });
  if (!source) { console.log("Нет источника"); process.exit(1); }
  const config = source.config as Record<string, unknown>;
  const cookieStr = (config.cookies as string) || "";

  const headers = {
    "Cookie": cookieStr,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  // GraphQL эндпоинты
  const gqlUrls = [
    "https://profi.ru/api/graphql",
    "https://profi.ru/graphql",
    "https://profi.ru/api/graphql/",
    "https://profi.ru/api/v1/graphql",
    "https://profi.ru/cabinet/api/graphql",
  ];

  const query = JSON.stringify({
    operationName: "CurrentOrders",
    query: "query CurrentOrders { currentOrders { id title } }"
  });

  for (const url of gqlUrls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: query,
        signal: AbortSignal.timeout(10000),
      });
      const text = await res.text();
      console.log(`${res.status} ${url}: ${text.slice(0, 150)}`);
    } catch (e) {
      console.log(`❌ ${url}`);
    }
  }

  // Пробуем найти GraphQL в JS
  const htmlRes = await fetch("https://profi.ru/cabinet/orders/", { headers: { ...headers, "Accept": "text/html" } });
  const html = await htmlRes.text();
  const scripts = html.match(/src="(\/_next\/static\/[^"]+\.js)"/g) || [];
  
  for (const script of scripts.slice(0, 5)) {
    const jsUrl = `https://profi.ru${script.replace(/src="|"/g, "")}`;
    const jsRes = await fetch(jsUrl, { headers, signal: AbortSignal.timeout(10000) });
    const js = await jsRes.text();
    const gqlMatch = js.match(/https?:\/\/[^"'\s]*graphql[^"'\s]*/gi);
    if (gqlMatch) console.log(`🔍 ${script}:`, gqlMatch[0]);
  }

  process.exit(0);
}
main();
