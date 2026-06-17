import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    console.log("📄 Вход с новым паролем...");
    await page.goto("https://profi.ru/backoffice/n.php", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector('[data-testid="auth_login_input"]', { timeout: 15000 });
    await page.fill('[data-testid="auth_login_input"]', "TimofeyevAG11");
    await page.locator('input[type="password"]').first().fill("Bilariuss111111");
    await page.click('[data-testid="enter_with_sms_btn"]');
    
    await page.waitForTimeout(8000);
    console.log("📍 URL:", page.url());

    const bodyText = await page.locator("body").innerText();
    console.log("📝", bodyText.slice(0, 400));

    // Проверим есть ли "Некорректный логин"
    if (bodyText.includes("Некорректный")) {
      console.log("❌ Всё ещё ошибка логина");
    } else if (bodyText.includes("заказ") || bodyText.includes("Заказ")) {
      console.log("✅ Есть заказы!");
    } else {
      console.log("🤔 Непонятно — сохраняю скриншот");
      await page.screenshot({ path: "/tmp/profi-v6.png", fullPage: true });
    }

  } catch (e) { console.error("❌", e); }
  finally { await browser.close(); console.log("🏁"); }
}
main();
