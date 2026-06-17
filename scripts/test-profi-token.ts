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
  };

  // 1. Пробуем обновить токен
  console.log("🔑 Пробую обновить токен...");
  try {
    const tokenRes = await fetch("https://profi.ru/auth/token/renew", {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(10000),
    });
    const tokenText = await tokenRes.text();
    console.log(`  ${tokenRes.status}: ${tokenText.slice(0, 200)}`);
    
    if (tokenRes.ok) {
      try {
        const tokenData = JSON.parse(tokenText);
        console.log("  ✅ Токен получен:", Object.keys(tokenData));
        // Если есть accessToken — используем его
        if (tokenData.accessToken || tokenData.token || tokenData.jwt) {
          const jwt = tokenData.accessToken || tokenData.token || tokenData.jwt;
          console.log("  JWT:", jwt.slice(0, 50) + "...");
        }
      } catch {}
    }
  } catch (e) {
    console.log("  ❌", e);
  }

  // 2. Пробуем GraphQL с разными заголовками
  console.log("\n📊 Пробую GraphQL...");
  const gqlQuery = JSON.stringify({
    operationName: "OrdersList",
    query: "query OrdersList { orders { nodes { id title price } } }"
  });

  const gqlHeaders = [
    { ...headers },
    { ...headers, "Apollo-Require-Preflight": "true" },
    { ...headers, "X-Requested-With": "XMLHttpRequest" },
    { ...headers, "Origin": "https://profi.ru", "Referer": "https://profi.ru/cabinet/orders/" },
  ];

  for (const h of gqlHeaders) {
    try {
      const res = await fetch("https://profi.ru/graphql", {
        method: "POST",
        headers: h,
        body: gqlQuery,
        signal: AbortSignal.timeout(10000),
      });
      const text = await res.text();
      console.log(`  ${res.status}: ${text.slice(0, 150)}`);
      if (res.status === 200) {
        console.log("  🎉 УСПЕХ!");
        console.log("  Заголовки:", JSON.stringify(Object.fromEntries(res.headers.entries())));
      }
    } catch (e) {
      console.log(`  ❌`);
    }
  }

  process.exit(0);
}
main();
