// Тест Profi.ru через Playwright — авторизация и разведка страницы заказов
import { chromium } from "playwright";

const PROFI_EMAIL = "bilariuss@yandex.ru";
const PROFI_PASSWORD = "bilariuss111111";

async function test() {
  console.log("🚀 Запуск браузера...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    // 1. Открываем страницу логина
    console.log("📄 Открываю страницу логина...");
    await page.goto("https://profi.ru/cabinet/login/", { waitUntil: "domcontentloaded", timeout: 30000 });
    
    // Ждём появления любого поля ввода
    await page.waitForSelector('input', { timeout: 15000 });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "/tmp/profi-login.png", fullPage: true });
    console.log("📸 Скриншот логина сохранён");

    // Получаем HTML формы
    const html = await page.content();
    require("fs").writeFileSync("/tmp/profi-login.html", html);
    console.log("💾 HTML логина:", html.length, "байт");

    // Ищем все input поля
    const inputs = await page.locator('input').evaluateAll(els => 
      els.map(el => ({
        type: el.getAttribute('type'),
        name: el.getAttribute('name'),
        placeholder: el.getAttribute('placeholder'),
        id: el.getAttribute('id'),
        class: el.getAttribute('class')?.slice(0, 80),
      }))
    );
    console.log("📋 Input поля:", JSON.stringify(inputs, null, 2));

    // Ищем кнопки
    const buttons = await page.locator('button, input[type="submit"]').evaluateAll(els =>
      els.map(el => ({
        tag: el.tagName,
        type: el.getAttribute('type'),
        text: el.textContent?.trim()?.slice(0, 50),
      }))
    );
    console.log("🔘 Кнопки:", JSON.stringify(buttons, null, 2));

    // 2. Пробуем заполнить и войти
    console.log("🔐 Пробую авторизацию...");
    const emailField = page.locator('input[type="email"]').first();
    const passField = page.locator('input[type="password"]').first();

    if (await emailField.count() > 0) {
      await emailField.fill(PROFI_EMAIL);
      await passField.fill(PROFI_PASSWORD);
      
      // Ищем кнопку "Войти"
      const loginBtn = page.locator('button:has-text("Войти"), button[type="submit"], input[type="submit"]').first();
      await loginBtn.click();
      
      await page.waitForTimeout(4000);
      console.log("📍 URL после входа:", page.url());
      await page.screenshot({ path: "/tmp/profi-after-login.png", fullPage: false });
      console.log("📸 Скриншот после логина сохранён");
      require("fs").writeFileSync("/tmp/profi-after-login.html", await page.content());
    } else {
      console.log("⚠️ Поле email не найдено, пробую другие селекторы...");
      // Возможно это модальное окно или другая форма
      const allText = await page.locator('body').innerText();
      console.log("📝 Текст страницы (первые 500):", allText.slice(0, 500));
    }

  } catch (err) {
    console.error("❌ Ошибка:", err);
    const html = await page.content().catch(() => "");
    require("fs").writeFileSync("/tmp/profi-error.html", html);
    await page.screenshot({ path: "/tmp/profi-error.png", fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
    console.log("🏁 Браузер закрыт");
  }
}

test();
