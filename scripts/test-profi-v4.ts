import { chromium } from "playwright";

const FULL_QUERY = `#prfrtkn:webbo:36bb338fde61287ba8723d0687db52f33ab381d8:9b53a063284429f629f81506c40339c13822dd22

query BoSearchBoardItems($filter: BoSearchFrontFiltersInput!, $allVerticals: Boolean, $searchQuery: String, $pageSize: Int, $sort: BoSearchSortEnum) @domain(domains: [BO_BOARD, BO_BOARD_LIST]) {
  boSearchBoardItems(filter: $filter, allVerticals: $allVerticals, searchQuery: $searchQuery, pageSize: $pageSize, sort: $sort) {
    totalCount
    items { id type ... on BoSearchSnippet { title description price { value } } }
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

    const cookies = await context.cookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    // Пробуем разные переменные
    const variants = [
      { name: "без фильтра, без saved", vars: { pageSize: 10, sort: "DEFAULT", filter: {} } },
      { name: "useSavedFilter:true", vars: { allVerticals: true, pageSize: 10, useSavedFilter: true, sort: "DEFAULT", filter: {} } },
      { name: "searchQuery=сайт", vars: { allVerticals: true, searchQuery: "сайт", pageSize: 10, sort: "DEFAULT", filter: {} } },
      { name: "searchQuery=бот", vars: { allVerticals: true, searchQuery: "бот", pageSize: 10, sort: "DEFAULT", filter: {} } },
    ];

    for (const v of variants) {
      const res = await fetch("https://rnd.profi.ru/graphql", {
        method: "POST",
        headers: {
          "origin": "https://rnd.profi.ru",
          "referer": "https://rnd.profi.ru/backoffice/n.php",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
          "x-app-id": "BO", "x-new-auth-compatible": "1", "content-type": "application/json",
          "cookie": cookieStr,
        },
        body: JSON.stringify({ query: FULL_QUERY, variables: v.vars }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      const items = data?.data?.boSearchBoardItems?.items || [];
      const total = data?.data?.boSearchBoardItems?.totalCount || 0;
      console.log(`[${v.name}]: total=${total}, items=${items.length}`);
      for (const item of items.slice(0, 3)) {
        if (item.title) console.log(`  • ${item.title?.slice(0, 80)}`);
      }
      if (data.errors) console.log("  ERRORS:", JSON.stringify(data.errors).slice(0, 200));
    }

  } catch (e) { console.error("❌", e); }
  finally { await browser.close(); console.log("🏁"); }
}
main();
