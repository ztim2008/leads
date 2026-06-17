import { chromium } from "playwright";
import { db } from "../src/lib/db";

async function main() {
  const source = await db.source.findFirst({ where: { platform: "profi" } });
  if (!source) { console.log("Нет источника"); process.exit(1); }

  const config = source.config as Record<string, unknown>;
  const cookieStr = (config.cookies as string) || "";

  // Парсим куки в формате "name=value; name2=value2"
  const pairs = cookieStr.split(";").map(p => p.trim()).filter(Boolean);
  const cookies: Array<{name: string, value: string, domain: string, path: string}> = [];
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq > 0) {
      cookies.push({
        name: pair.slice(0, eq).trim(),
        value: pair.slice(eq + 1).trim(),
        domain: ".profi.ru",
        path: "/",
      });
    }
  }

  console.log(`🍪 ${cookies.length} кук загружено`);
  console.log("");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    await page.goto("https://profi.ru/cabinet/orders/", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    console.log("📍 URL:", page.url());

    // Ждём загрузки
    try {
      await page.waitForSelector("[class*=orders_list]", { timeout: 10000 });
      console.log("✅ Список заказов найден");
    } catch {
      console.log("⏳ Жду ещё 5с...");
      await page.waitForTimeout(5000);
    }

    // Снимаем скриншот
    await page.screenshot({ path: "/tmp/profi-v3.png", fullPage: true });
    console.log("📸 Скриншот сохранён");

    // Получаем весь текст
    const bodyText = await page.locator("body").innerText();
    console.log("\n📝 Текст (первые 600):");
    console.log(bodyText.slice(0, 600));

    // Сохраняем HTML
    require("fs").writeFileSync("/tmp/profi-v3.html", await page.content());

    // Ищем все ссылки
    const allLinks = await page.locator("a[href]").evaluateAll(els =>
      els.map(el => ({
        h: (el as HTMLAnchorElement).href,
        t: el.textContent?.trim()?.slice(0, 80) || "",
      })).filter(l => l.t.length > 5)
    );
    console.log(`\n🔗 Всего ссылок: ${allLinks.length}`);
    const orderLinks = allLinks.filter(l => l.h.includes("/tasks/") || l.h.includes("/orders/") || l.h.includes("/view/"));
    console.log(`🔗 Из них заказов: ${orderLinks.length}`);
    orderLinks.slice(0, 10).forEach(l => console.log("  •", l.t));

  } catch (e) {
    console.error("❌", e);
  } finally {
    await browser.close();
    console.log("\n🏁 Готово");
  }
  process.exit(0);
}
main();
