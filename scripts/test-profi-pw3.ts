import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    // Входим
    console.log("📄 Вход...");
    await page.goto("https://profi.ru/backoffice/n.php", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector('[data-testid="auth_login_input"]', { timeout: 15000 });
    await page.fill('[data-testid="auth_login_input"]', "TimofeyevAG11");
    await page.locator('input[type="password"]').first().fill("bilariuss111111");
    await page.click('[data-testid="enter_with_sms_btn"]');
    
    // Ждём загрузки страницы заказов
    console.log("⏳ Жду загрузки...");
    await page.waitForTimeout(8000);
    
    console.log("📍 URL:", page.url());
    await page.screenshot({ path: "/tmp/profi-backoffice.png", fullPage: true });
    console.log("📸 Скриншот сохранён");

    // Ищем заказы
    const bodyText = await page.locator("body").innerText();
    console.log("\n📝 Текст (500):", bodyText.slice(0, 500));

    // Ищем карточки заказов
    const selectors = [
      '[data-testid$="order-snippet"]',
      '[class*="order" i]',
      '[class*="snippet" i]',
      'a[href*="?o="]',
    ];

    for (const sel of selectors) {
      const count = await page.locator(sel).count();
      if (count > 0) console.log(`🔍 "${sel}": ${count} шт.`);
    }

    // Сохраняем HTML
    require("fs").writeFileSync("/tmp/profi-backoffice.html", await page.content());
    console.log("💾 HTML сохранён");

    // Пробуем кликнуть на первый заказ если есть
    const orderLinks = await page.locator('a[href*="?o="]').evaluateAll(els =>
      els.map(el => ({
        href: (el as HTMLAnchorElement).href,
        text: el.textContent?.trim()?.slice(0, 80),
      }))
    );
    console.log(`\n🔗 Ссылок с ?o=: ${orderLinks.length}`);
    orderLinks.slice(0, 5).forEach(l => console.log("  •", l.text));

  } catch (e) { console.error("❌", e); }
  finally { await browser.close(); console.log("🏁"); }
}
main();
