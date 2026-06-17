import { chromium } from "playwright";

// Полный GraphQL запрос из работающего парсера
const FULL_QUERY = `#prfrtkn:webbo:36bb338fde61287ba8723d0687db52f33ab381d8:9b53a063284429f629f81506c40339c13822dd22

query BoSearchBoardItems($filter: BoSearchFrontFiltersInput!, $useSavedFilter: Boolean, $allVerticals: Boolean, $searchQuery: String, $searchEntities: [BoSearchEntityInput!], $searchId: ID, $nextCursor: String, $pageSize: Int, $boSortUp: Int, $minScore: Float, $coordinates: BoSearchAreaInput, $clusterId: ID, $sort: BoSearchSortEnum) @domain(domains: [BO_BOARD, BO_BOARD_LIST]) {
  boSearchBoardItems(
    filter: $filter
    useSavedFilter: $useSavedFilter
    allVerticals: $allVerticals
    searchQuery: $searchQuery
    searchEntities: $searchEntities
    searchId: $searchId
    nextCursor: $nextCursor
    pageSize: $pageSize
    boSortUp: $boSortUp
    minScore: $minScore
    coordinates: $coordinates
    clusterId: $clusterId
    sort: $sort
  ) {
    nextCursor
    serverTs
    totalCount
    items {
      id
      type
      ... on BoSearchSnippet {
        score
        title
        description
        isFresh
        lastUpdateDate
        analyticsData { caseId score }
        geo {
          clientMayCome { address }
          orderLocation { address }
          remote { address }
        }
        price { prefix suffix value }
        secondPrice { prefix suffix value }
        clientInfo { name }
      }
      ... on BoSearchPremiumBlock { title description buttonLabel }
      ... on BoSearchPremiumRepeatBlock { title }
    }
  }
}`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    await page.goto("https://profi.ru/backoffice/n.php", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector('[data-testid="auth_login_input"]', { timeout: 15000 });
    
    await page.fill('[data-testid="auth_login_input"]', "TimofeyevAG11");
    await page.locator('input[type="password"]').first().fill("bilariuss111111");
    await page.click('[data-testid="enter_with_sms_btn"]');
    await page.waitForTimeout(5000);

    console.log("📍 URL:", page.url());

    // Получаем ВСЕ куки для GraphQL
    const allCookies = await context.cookies();
    const cookieStr = allCookies.map(c => `${c.name}=${c.value}`).join("; ");
    const token = allCookies.find(c => c.name === "prfr_bo_tkn")?.value;
    console.log(`🔑 Токен: ${token ? "✅ " + token.length + " символов" : "❌ НЕТ"}`);

    if (!token) { console.log("Нет токена"); return; }

    // Пробуем 3 варианта передачи кук
    const attempts = [
      { name: "только prfr_bo_tkn", cookie: `prfr_bo_tkn=${token}` },
      { name: "все куки", cookie: cookieStr },
      { name: "все куки + Authorization", cookie: cookieStr, auth: `Bearer ${token}` },
    ];

    for (const att of attempts) {
      const headers: Record<string, string> = {
        "origin": "https://rnd.profi.ru",
        "referer": "https://rnd.profi.ru/backoffice/n.php",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        "x-app-id": "BO",
        "x-new-auth-compatible": "1",
        "content-type": "application/json",
        "cookie": att.cookie,
      };
      if (att.auth) headers["authorization"] = att.auth;

      try {
        const res = await fetch("https://rnd.profi.ru/graphql", {
          method: "POST",
          headers,
          body: JSON.stringify({
            query: FULL_QUERY,
            variables: { allVerticals: true, pageSize: 10, useSavedFilter: true, sort: "DEFAULT", filter: {} },
          }),
          signal: AbortSignal.timeout(15000),
        });
        const txt = await res.text();
        console.log(`\n📡 [${att.name}]: ${res.status}`);
        if (res.status === 200) {
          const data = JSON.parse(txt);
          const items = data?.data?.boSearchBoardItems?.items || [];
          console.log(`  🎉 ЗАКАЗОВ: ${items.length}`);
          for (const item of items.slice(0, 5)) {
            if (item.title) console.log(`  • ${item.title?.slice(0, 80)} 💰 ${item.price?.value || "?"}`);
          }
        } else {
          console.log(`  ${txt.slice(0, 150)}`);
        }
      } catch (e) {
        console.log(`  ❌ ${e}`);
      }
    }

  } catch (e) { console.error("❌", e); }
  finally { await browser.close(); console.log("🏁"); }
}
main();
