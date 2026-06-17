// Ищем API-эндпоинты в JS-бандлах страницы заказов Profi.ru
async function main() {
  const source = await (await import("../src/lib/db")).db.source.findFirst({ 
    where: { platform: "profi" } 
  });
  if (!source) { console.log("Нет источника"); process.exit(1); }
  const config = source.config as Record<string, unknown>;
  const cookieStr = (config.cookies as string) || "";

  const headers = {
    "Cookie": cookieStr,
    "User-Agent": "Mozilla/5.0",
  };

  // Получаем HTML страницы
  const htmlRes = await fetch("https://profi.ru/cabinet/orders/", { headers: { ...headers, "Accept": "text/html" } });
  const html = await htmlRes.text();

  // Находим все JS-бандлы
  const scriptMatches = html.match(/src="(\/_next\/static\/[^"]+\.js)"/g);
  if (!scriptMatches) { console.log("Скрипты не найдены"); process.exit(0); }

  const scripts = scriptMatches.map(s => s.replace(/src="|"/g, ""));
  console.log(`Найдено ${scripts.length} скриптов`);

  const apiCandidates = new Set<string>();

  for (const script of scripts.slice(0, 8)) {
    const url = `https://profi.ru${script}`;
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
      const js = await res.text();

      // Ищем API-пути
      const apiMatches = js.match(/\/api\/[a-z0-9_\/-]+/gi) || [];
      const dataMatches = js.match(/\/cabinet\/[a-z0-9_\/-]+/gi) || [];
      const fetchMatches = js.match(/fetch\(["'][^"']+["']\)/g) || [];
      const orderMatches = js.match(/["'][^"']*orders?[^"']*["']/gi) || [];

      for (const m of [...apiMatches, ...fetchMatches, ...orderMatches]) {
        const cleaned = m.replace(/^fetch\(["']|["']\)$/g, "").replace(/["']/g, "");
        if (cleaned.length > 3 && cleaned.length < 100) apiCandidates.add(cleaned);
      }
    } catch (e) {
      console.log(`Ошибка загрузки ${script}`);
    }
  }

  console.log(`\n🔍 Найдено ${apiCandidates.size} кандидатов API:`);
  const sorted = [...apiCandidates].sort();
  sorted.filter(s => s.includes("order") || s.includes("task") || s.includes("api/"))
    .forEach(s => console.log("  ", s));
  
  console.log("\nВсе кандидаты:");
  sorted.forEach(s => console.log("  ", s));

  process.exit(0);
}
main();
