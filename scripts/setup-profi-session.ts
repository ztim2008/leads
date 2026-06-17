// Настройка сессии Profi.ru — запусти локально на своём компьютере
// Команда: npx tsx scripts/setup-profi-session.ts
//
// 1. Откроется браузер с формой входа Profi.ru
// 2. Войди: введи телефон, дождись SMS, введи код
// 3. После входа скрипт сохранит сессию в profi-state.json
// 4. Загрузи profi-state.json на сервер в ту же папку scripts/

import { chromium } from "playwright";
import { writeFileSync, existsSync } from "fs";
import { join } from "path";

const STATE_FILE = join(__dirname, "..", "profi-state.json");

async function setup() {
  console.log("🔧 Настройка сессии Profi.ru");
  console.log("=" .repeat(50));
  console.log("");
  console.log("📌 Сейчас откроется браузер.");
  console.log("📌 Войди в Profi.ru: номер телефона → SMS → код");
  console.log("📌 После входа закрой браузер или нажми Ctrl+C в терминале");
  console.log("");

  const browser = await chromium.launch({ 
    headless: false,
    args: ["--no-sandbox"]
  });
  
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
  });

  const page = await context.newPage();

  // Открываем страницу входа
  await page.goto("https://profi.ru/cabinet/login/", { 
    waitUntil: "domcontentloaded",
    timeout: 30000 
  });

  console.log("✅ Браузер открыт. Войди в Profi.ru.");
  console.log("⏳ Ожидаю входа... (закрой браузер когда закончишь)");
  console.log("");

  // Ждём пока URL изменится (пользователь вошёл)
  try {
    await page.waitForURL(
      url => !url.href.includes("/login") && !url.href.includes("/auth"),
      { timeout: 300_000 } // 5 минут на вход
    );
    console.log("✅ Вход выполнен! Сохраняю сессию...");
  } catch {
    console.log("⚠️ Не удалось определить вход. Сохраняю что есть...");
  }

  // Сохраняем состояние
  await context.storageState({ path: STATE_FILE });
  console.log(`💾 Сессия сохранена: ${STATE_FILE}`);
  console.log("");
  console.log("📤 Теперь загрузи profi-state.json на сервер:");
  console.log(`   scp profi-state.json root@109.196.165.106:/var/www/www-root/data/www/leads.konversus.ru/profi-state.json`);
  console.log("");
  console.log("✅ Готово!");

  await browser.close();
}

setup().catch(console.error);
