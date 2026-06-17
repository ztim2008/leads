import { chromium } from "playwright";

// ТОЧНАЯ копия запроса из dobrozor/parser_profiru
const QUERY = "#prfrtkn:webbo:36bb338fde61287ba8723d0687db52f33ab381d8:9b53a063284429f629f81506c40339c13822dd22\n\n      query BoSearchBoardItems($filter: BoSearchFrontFiltersInput!, $useSavedFilter: Boolean, $allVerticals: Boolean, $searchQuery: String, $searchEntities: [BoSearchEntityInput!], $searchId: ID, $nextCursor: String, $pageSize: Int, $boSortUp: Int, $minScore: Float, $coordinates: BoSearchAreaInput, $clusterId: ID, $sort: BoSearchSortEnum) @domain(domains: [BO_BOARD, BO_BOARD_LIST]) {\n  boSearchBoardItems(\n    filter: $filter\n    useSavedFilter: $useSavedFilter\n    allVerticals: $allVerticals\n    searchQuery: $searchQuery\n    searchEntities: $searchEntities\n    searchId: $searchId\n    nextCursor: $nextCursor\n    pageSize: $pageSize\n    boSortUp: $boSortUp\n    minScore: $minScore\n    coordinates: $coordinates\n    clusterId: $clusterId\n    sort: $sort\n  ) {\n    nextCursor\n    serverTs\n    totalCount\n    analytics {\n      boardSearchQuery\n      boardSearchUsed\n    }\n    items {\n      id\n      type\n      ... on BoSearchPremiumBlock {\n        title\n        description\n        buttonLabel\n      }\n      ... on BoSearchPremiumRepeatBlock {\n        title\n      }\n      ... on BoSearchSnippet {\n        ...snippetFieldsCommon\n        isFresh\n        coordinates {\n          lat\n          lon\n        }\n        clientInfo {\n          name\n        }\n        clientTags {\n          value\n        }\n        badges {\n          id\n          imageKey\n          label\n        }\n        status {\n          text\n          color\n        }\n        schedule\n        images {\n          host\n          width\n          height\n          original\n        }\n      }\n      ... on BoSearchEmptyState {\n        view {\n          title\n          description\n          imageKey\n          button {\n            label\n            actionType\n          }\n        }\n      }\n      ... on BoSearchStories {\n        id\n        type\n      }\n      ... on BoSearchDivider {\n        title\n        button {\n          label\n          actionType\n        }\n      }\n      ... on BoSearchCarousel {\n        snippets {\n          id\n          isFresh\n          ...snippetFieldsCommon\n        }\n      }\n      ... on BoSearchSurvey {\n        id\n        type\n        title\n        surveyKey\n        options {\n          type\n          title\n          formId\n        }\n      }\n      ... on BoSearchAdFoxBanner {\n        adUnitId\n      }\n    }\n  }\n}\n      fragment snippetFieldsCommon on BoSearchSnippet {\n  score\n  title\n  description\n  isReposted\n  lastUpdateDate\n  analyticsData {\n    caseId\n    score\n  }\n  geo {\n    clientMayCome {\n      address\n      geoplaces {\n        code\n        color\n        distance\n        name\n      }\n      prefix\n      suffix\n    }\n    orderLocation {\n      address\n      geoplaces {\n        code\n        color\n        distance\n        name\n        prepDistance\n      }\n      prefix\n      suffix\n    }\n    remote {\n      address\n      geoplaces {\n        code\n        color\n        distance\n        name\n        prepDistance\n      }\n      prefix\n      suffix\n    }\n  }\n  price {\n    prefix\n    suffix\n    value\n  }\n  secondPrice {\n    prefix\n    suffix\n    value\n  }\n  headerIcon\n  isViewed\n  shouldRequestRefuseReasons\n}";

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

    const res = await fetch("https://rnd.profi.ru/graphql", {
      method: "POST",
      headers: {
        "origin": "https://rnd.profi.ru",
        "referer": "https://rnd.profi.ru/backoffice/n.php",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        "x-app-id": "BO",
        "x-new-auth-compatible": "1",
        "content-type": "application/json",
        "cookie": cookieStr,
      },
      body: JSON.stringify({
        query: QUERY,
        variables: {
          allVerticals: true,
          searchQuery: "",
          searchEntities: [],
          pageSize: 20,
          useSavedFilter: true,
          sort: "DEFAULT",
          filter: {},
        },
      }),
      signal: AbortSignal.timeout(20000),
    });

    console.log("Статус:", res.status);
    const data = await res.json();
    
    if (data.errors) {
      console.log("Ошибки:", JSON.stringify(data.errors).slice(0, 300));
    }

    const items = data?.data?.boSearchBoardItems?.items || [];
    const total = data?.data?.boSearchBoardItems?.totalCount || 0;
    console.log(`Всего: ${total}, Получено: ${items.length}`);

    for (const item of items.slice(0, 10)) {
      if (item.type === "SNIPPET" || item.__typename === "BoSearchSnippet") {
        console.log(`  • ${item.title?.slice(0, 80)} | 💰 ${item.price?.value || "?"} | ${item.clientInfo?.name || ""}`);
      } else {
        console.log(`  [${item.type}] ${item.title || item.id}`);
      }
    }

  } catch (e) { console.error("❌", e); }
  finally { await browser.close(); console.log("🏁"); }
}
main();
