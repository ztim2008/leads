import { chromium } from "playwright";
import { db } from "/var/www/www-root/data/www/leads.konversus.ru/src/lib/db";

async function main() {
  const source = await db.source.findFirst({ where: { platform: "profi" } });
  if (!source) { console.log("Нет источника"); process.exit(1); }

  const config = source.config as Record<string, unknown>;
  const rawCookies = config.cookies as string;

  const lines = rawCookies.split("\n").filter(Boolean);
  const cookies: Array<{name: string, value: string, domain: string, path: string}> = [];
  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length >= 2) {
      cookies.push({ name: parts[0], value: parts[1], domain: ".profi.ru", path: "/" });
    }
  }

  console.log("🍪 Кук:", cookies.length);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    // Используем domcontentloaded вместо networkidle
    await page.goto("https://profi.ru/cabinet/orders/", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    console.log("📍 URL:", page.url());

    // Ждём появления заказов (до 10 секунд)
    try {
      await page.waitForSelector("[class*=orders_]", { timeout: 10000 });
      console.log("✅ Заказы загрузились");
    } catch {
      console.log("⚠️ Селектор заказов не найден, жду ещё 5с...");
      await page.waitForTimeout(5000);
    }

    await page.screenshot({ path: "/tmp/profi-orders2.png", fullPage: false });
    console.log("📸 Скриншот готов");

    // Ищем ВСЕ видимые заголовки
    const allText = await page.locator("body").innerText();
    console.log("\n📝 Текст страницы (первые 1000):");
    console.log(allText.slice(0, 1000));

    // Ищем ссылки на заказы
    const links = await page.locator("a").evaluateAll(els =>
      els.map(el => ({
        href: (el as HTMLAnchorElement).href,
        text: el.textContent?.trim()?.slice(0, 100) || "",
      })).filter(l => l.href && (l.href.includes("/tasks/") || l.href.includes("/orders/") || l.href.includes("/view/")))
    );
    console.log(`\n🔗 Ссылок на заказы: ${links.length}`);
    links.slice(0, 10).forEach(l => console.log("  ", l.text.slice(0, 80)));

  } catch (e) {
    console.error("❌", e);
  } finally {
    await browser.close();
    console.log("🏁 Готово");
  }
  process.exit(0);
}
main();
