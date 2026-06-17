import { db } from "../src/lib/db";
import { writeFileSync } from "fs";

async function main() {
  const source = await db.source.findFirst({ where: { platform: "profi" } });
  if (!source) { console.log("Нет источника"); process.exit(1); }

  const config = source.config as Record<string, unknown>;
  const cookieStr = (config.cookies as string) || "";

  // Делаем запрос
  console.log("🚀 Запрос к Profi.ru...");
  const res = await fetch("https://profi.ru/cabinet/orders/", {
    headers: {
      "Cookie": cookieStr,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "ru-RU,ru;q=0.9",
    },
    signal: AbortSignal.timeout(15_000),
    redirect: "follow",
  });

  console.log("HTTP:", res.status);
  console.log("Итоговый URL:", res.url);

  const html = await res.text();
  writeFileSync("/tmp/profi-http-v2.html", html);
  console.log("HTML:", (html.length / 1024).toFixed(0), "KB");

  // Проверяем признаки заказов
  if (html.includes("orders_list") || html.includes("orders__list")) {
    console.log("✅ Есть список заказов");
  }
  if (html.includes("order_card") || html.includes("order__card")) {
    console.log("✅ Есть карточки заказов");
  }

  // Ищем JSON-данные (Next.js гидрация)
  const jsonMatch = html.match(/__NEXT_DATA__[^>]*>({.*?})<\/script>/);
  if (jsonMatch) {
    const data = JSON.parse(jsonMatch[1]);
    console.log("\n📦 NEXT_DATA ключи:", Object.keys(data.props?.pageProps || {}).join(", "));
    
    // Ищем заказы в NEXT_DATA
    const props = data.props?.pageProps;
    if (props) {
      const ordersKey = Object.keys(props).find(k => 
        Array.isArray(props[k]) && props[k].length > 0
      );
      if (ordersKey) {
        console.log(`✅ Найдены заказы в props.${ordersKey}: ${props[ordersKey].length} шт.`);
        // Показываем первые 3
        props[ordersKey].slice(0, 3).forEach((o: any) => {
          console.log("  •", o.title || o.name || o.id, o.price ? `💰${o.price}` : "");
        });
      }
    }
  } else {
    console.log("⚠️ __NEXT_DATA__ не найден");
  }

  // Ищем любой JSON с заказами
  const apiPatterns = [/\"orders\"\s*:\s*\[/, /\"tasks\"\s*:\s*\[/, /\"items\"\s*:\s*\[/];
  for (const p of apiPatterns) {
    const m = html.match(p);
    if (m) console.log("🔍 Найден JSON:", m[0].slice(0, 50));
  }

  process.exit(0);
}
main();
