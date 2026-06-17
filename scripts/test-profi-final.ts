import { chromium } from "playwright";

const LOGIN = "TimofeyevAG11";
const PASSWORD = "bilariuss111111";
const LOGIN_URL = "https://profi.ru/backoffice/n.php";

async function main() {
  console.log("🚀 Запуск браузера...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  try {
    // 1. Открываем страницу логина
    console.log("📄", LOGIN_URL);
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

    // 2. Ждём поле логина
    const loginInput = page.locator('[data-testid="auth_login_input"]');
    await loginInput.waitFor({ timeout: 15000 });
    console.log("✅ Поле логина найдено");

    // 3. Заполняем
    await loginInput.fill(LOGIN);
    console.log("📝 Логин введён");

    const passInput = page.locator('input[type="password"]').first();
    await passInput.fill(PASSWORD);
    console.log("🔐 Пароль введён");

    // 4. Жмём кнопку входа
    const submitBtn = page.locator('[data-testid="enter_with_sms_btn"]');
    await submitBtn.click();
    console.log("👆 Кнопка нажата");

    // 5. Ждём загрузки
    await page.waitForTimeout(5000);

    const url = page.url();
    console.log("📍 URL:", url);

    // 6. Проверяем куки
    const cookies = await context.cookies();
    console.log(`🍪 Получено ${cookies.length} кук`);

    let token: string | null = null;
    for (const c of cookies) {
      if (c.name === "prfr_bo_tkn") {
        token = c.value;
        console.log(`🔑 TOKEN: ${c.value.slice(0, 20)}... (${c.value.length} символов)`);
      }
    }

    if (!token) {
      console.log("❌ Токен не найден. Все куки:");
      for (const c of cookies) {
        console.log(`  ${c.name}=${c.value.slice(0, 30)}`);
      }
    } else {
      // 7. Пробуем GraphQL
      console.log("\n📊 Тест GraphQL запроса...");
      const gqlRes = await fetch("https://rnd.profi.ru/graphql", {
        method: "POST",
        headers: {
          "origin": "https://rnd.profi.ru",
          "referer": "https://rnd.profi.ru/backoffice/n.php",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
          "x-app-id": "BO",
          "x-new-auth-compatible": "1",
          "content-type": "application/json",
          "cookie": `prfr_bo_tkn=${token}`,
        },
        body: JSON.stringify({
          query: `query BoSearchBoardItems($filter: BoSearchFrontFiltersInput!, $pageSize: Int) @domain(domains: [BO_BOARD, BO_BOARD_LIST]) { boSearchBoardItems(filter: $filter, pageSize: $pageSize) { totalCount items { id type ... on BoSearchSnippet { title description price { value prefix suffix } } } } }`,
          variables: { pageSize: 5, filter: {} },
        }),
        signal: AbortSignal.timeout(15000),
      });

      console.log("📡 Статус:", gqlRes.status);
      const data = await gqlRes.json();
      const items = data?.data?.boSearchBoardItems?.items || [];
      console.log(`📦 Заказов: ${items.length}`);

      for (const item of items.slice(0, 5)) {
        if (item.type === "SNIPPET") {
          console.log(`  • ${item.title?.slice(0, 80)} | 💰 ${item.price?.value || "?"} ₽`);
        }
      }
    }

    await page.screenshot({ path: "/tmp/profi-final.png", fullPage: false });

  } catch (e) {
    console.error("❌", e);
  } finally {
    await browser.close();
    console.log("🏁 Готово");
  }
}
main();
