// Тест с storageState — правильный формат для Playwright
import { chromium } from "playwright";
import { db } from "../src/lib/db";
import { writeFileSync, unlinkSync, existsSync } from "fs";

async function main() {
  const source = await db.source.findFirst({ where: { platform: "profi" } });
  if (!source) { console.log("Нет источника"); process.exit(1); }
  const config = source.config as Record<string, unknown>;
  const cookieStr = (config.cookies as string) || "";

  // Разбираем куки из формата "name=value; name2=value2"
  const pairs = cookieStr.split(";").map(p => p.trim()).filter(Boolean);
  const cookies: any[] = [];
  
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();

    cookies.push({
      name,
      value,
      domain: ".profi.ru",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
      expires: Math.floor(Date.now() / 1000) + 86400 * 30,
    });
  }

  // Создаём storageState файл
  const state = { cookies, origins: [] };
  const statePath = "/tmp/profi-state.json";
  writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log(`💾 StorageState создан: ${cookies.length} кук`);

  // Запускаем с storageState
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: statePath });
  const page = await context.newPage();

  try {
    console.log("📄 Открываю страницу...");
    const resp = await page.goto("https://profi.ru/cabinet/orders/", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    console.log("📍 URL:", page.url());
    console.log("📡 Статус:", resp?.status());

    // Ждём загрузки
    await page.waitForTimeout(5000);

    // Проверяем наличие заказов
    const bodyText = await page.locator("body").innerText();
    const isLogin = bodyText.includes("Вход и регистрация") && bodyText.includes("Продолжить");
    
    if (isLogin) {
      console.log("❌ Страница логина — куки не приняты");
    } else {
      console.log("✅ НЕ страница логина!");
      console.log("📝 Текст (первые 300):", bodyText.slice(0, 300));
      
      // Ищем заказы
      const cards = await page.locator('[class*="order" i], [class*="task" i]').count();
      console.log(`📦 Элементов с order/task: ${cards}`);
    }

    await page.screenshot({ path: "/tmp/profi-ss.png", fullPage: true });
    console.log("📸 Скриншот сохранён");

    // Сохраняем состояние после загрузки
    const newState = await context.storageState();
    writeFileSync("/tmp/profi-state-after.json", JSON.stringify(newState, null, 2));
    console.log("💾 Состояние после загрузки сохранено");
    console.log(`   Кук до: ${cookies.length}, после: ${newState.cookies.length}`);

  } catch (e) {
    console.error("❌", e);
  } finally {
    await browser.close();
    console.log("🏁 Готово");
  }
  process.exit(0);
}
main();
