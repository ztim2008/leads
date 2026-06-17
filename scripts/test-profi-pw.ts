import { chromium } from "playwright";
import { db } from "/var/www/www-root/data/www/leads.konversus.ru/src/lib/db";

async function main() {
  const source = await db.source.findFirst({ where: { platform: "profi" } });
  if (!source) { console.log("❌ Нет источника"); process.exit(1); }

  const config = source.config as Record<string, unknown>;
  const rawCookies = config.cookies as string;

  // Форматируем куки для Playwright
  const lines = rawCookies.split("\n").filter(Boolean);
  const cookies: Array<{name: string, value: string, domain: string, path: string}> = [];
  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length >= 2) {
      cookies.push({
        name: parts[0],
        value: parts[1],
        domain: parts[2] || ".profi.ru",
        path: parts[3] || "/",
      });
    }
  }

  console.log(`🍪 Загружено ${cookies.length} кук`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(cookies);

  const page = await context.newPage();

  try {
    console.log("📄 Открываю страницу заказов...");
    await page.goto("https://profi.ru/cabinet/orders/", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    console.log("📍 URL:", page.url());

    // Ждём загрузки заказов
    await page.waitForTimeout(3000);

    // Сохраняем скриншот
    await page.screenshot({ path: "/tmp/profi-orders.png", fullPage: false });
    console.log("📸 Скриншот сохранён");

    // Ищем заказы
    const orderSelectors = [
      "[class*=order]",
      "[class*=task]",
      "[class*=request]",
      "[class*=card]",
      "article",
      "[data-testid]",
    ];

    for (const sel of orderSelectors) {
      const count = await page.locator(sel).count();
      if (count > 0 && count < 100) {
        console.log(`  🔍 "${sel}": ${count} шт.`);
      }
    }

    // Пробуем найти заголовки
    const headings = await page.locator("h2, h3, h4, h5").allTextContents();
    const filtered = headings.map(h => h.trim()).filter(h => h.length > 10 && h.length < 200);
    console.log("\n📝 Заголовки (первые 10):");
    filtered.slice(0, 10).forEach((h, i) => console.log(`  ${i+1}. ${h}`));

    // Сохраняем HTML после JS-рендера
    const html = await page.content();
    require("fs").writeFileSync("/tmp/profi-orders-rendered.html", html);
    console.log(`\n💾 HTML рендера: ${(html.length/1024).toFixed(0)} KB`);

    // Ищем ссылки на заказы
    const links = await page.locator("a[href*='/tasks/'], a[href*='/orders/'], a[href*='/view/']").evaluateAll(
      els => els.map(el => ({
        href: (el as HTMLAnchorElement).href,
        text: el.textContent?.trim()?.slice(0, 100) || "",
      }))
    );
    console.log(`\n🔗 Найдено ${links.length} ссылок на заказы`);
    links.slice(0, 5).forEach(l => console.log(`  ${l.text.slice(0, 80)}`));

  } catch (e) {
    console.error("❌", e);
    await page.screenshot({ path: "/tmp/profi-error.png" });
  } finally {
    await browser.close();
    console.log("🏁 Готово");
  }
  process.exit(0);
}
main();
