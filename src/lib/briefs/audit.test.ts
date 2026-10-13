import assert from "node:assert/strict";
import test from "node:test";
import {
  factsFromPages,
  factsFromSiteFiles,
  isPrivateIp,
  parsePage,
  parseRobots,
  parseSitemap,
  pickInternalLinks,
  pricesInText,
  sameUrl,
  type PageSnapshot,
} from "./fetch-site";
import { acceptModelFindings } from "./interpret";

test("private addresses are blocked", () => {
  assert.equal(isPrivateIp("127.0.0.1"), true);
  assert.equal(isPrivateIp("10.1.2.3"), true);
  assert.equal(isPrivateIp("192.168.0.8"), true);
  assert.equal(isPrivateIp("172.16.0.1"), true);
  assert.equal(isPrivateIp("8.8.8.8"), false);
});

test("parser reads title, price, form and viewport", () => {
  const html = `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width">
    <title>Каркасные дома в Казани</title>
    <meta name="description" content="Строим под ключ">
  </head><body>
    <h1>Дома под ключ</h1>
    <a href="/price">Цены</a>
    <a href="https://other.example/x">Чужой</a>
    <p>Стоимость от 45 000 руб. за м2</p>
    <form action="/lead"></form>
    <a href="tel:+78431234567">Позвонить</a>
    <a href="/order">Получить расчёт</a>
  </body></html>`;
  const page = parsePage(html, "https://client.example/");
  assert.equal(page.title, "Каркасные дома в Казани");
  assert.equal(page.h1, "Дома под ключ");
  assert.equal(page.hasForm, true);
  assert.equal(page.hasViewport, true);
  assert.equal(page.phones[0], "+78431234567");
  assert.ok(page.prices[0]?.includes("45 000"));
  assert.deepEqual(pricesInText("ПРИ ЗАКАЗЕ ОТ 1 000 000Р на пошив"), ["1 000 000Р"]);
  assert.deepEqual(pricesInText("1000 работы на участке"), []);
  assert.deepEqual(pickInternalLinks(html, "https://client.example/"), [
    "https://client.example/price",
    "https://client.example/order",
  ]);
});

test("page pick keeps contacts when the catalog has many links", () => {
  const html = [
    '<a href="/katalog/bryuki/gorka-3">Брюки Горка</a>',
    '<a href="/katalog/bryuki">Брюки</a>',
    '<a href="/katalog/noski">Носки</a>',
    '<a href="/katalog/zhilety">Жилеты</a>',
    '<a href="/uslugi">Услуги</a>',
    '<a href="/kontakty">Контакты</a>',
  ].join("");
  assert.deepEqual(pickInternalLinks(html, "https://www.k-spec.ru/"), [
    "https://www.k-spec.ru/uslugi",
    "https://www.k-spec.ru/katalog/bryuki",
    "https://www.k-spec.ru/katalog/noski",
    "https://www.k-spec.ru/kontakty",
  ]);
});

test("model findings without a quote from the page are dropped", () => {
  const pages: PageSnapshot[] = [
    {
      url: "https://client.example/",
      status: 200,
      title: "Каркасные дома",
      description: "",
      h1: "Дома под ключ",
      headings: [],
      textExcerpt: "Строим каркасные дома под ключ в Казани.",
      hasForm: false,
      hasViewport: true,
      phones: [],
      emails: [],
      prices: [],
      ctas: [],
      elapsedMs: 100,
    },
  ];
  const accepted = acceptModelFindings(
    {
      findings: [
        {
          kind: "hypothesis",
          title: "Оффер можно сузить",
          body: "На главной сказано про дома под ключ, но нет комплектации.",
          evidenceUrl: "https://client.example/",
          evidenceQuote: "Дома под ключ",
        },
        {
          kind: "recommendation",
          title: "Бюджет конкурентов",
          body: "Конкуренты тратят 500000 рублей в месяц.",
          evidenceUrl: "https://client.example/",
          evidenceQuote: "этой цитаты нет на странице",
        },
      ],
    },
    pages,
  );
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0]?.title, "Оффер можно сузить");
});

test("missing prices become a fact about the studied pages", () => {
  const facts = factsFromPages([
    {
      url: "https://client.example/",
      status: 200,
      title: "Дома",
      description: "",
      h1: "Дома",
      headings: [],
      textExcerpt: "Строим дома.",
      hasForm: false,
      hasViewport: true,
      phones: [],
      emails: [],
      prices: [],
      ctas: [],
      elapsedMs: 80,
    },
  ]);
  assert.ok(facts.some((fact) => fact.title.includes("не найдены")));
});

test("parser sees Metrika, call tracking, chat and canonical", () => {
  const html = `<html><head>
    <link rel="canonical" href="/uslugi/">
    <script src="https://mc.yandex.ru/metrika/tag.js"></script>
    <script>ym(68147536, "init", {});</script>
    <script src="//mod.calltouch.ru/init.js"></script>
    <script src="//code.jivo.ru/widget/abc"></script>
  </head><body><h1>Услуги</h1></body></html>`;
  const page = parsePage(html, "https://www.client.example/uslugi");
  assert.equal(page.metrika, true);
  assert.equal(page.metrikaId, "68147536");
  assert.deepEqual(page.calltracking, ["Calltouch"]);
  assert.deepEqual(page.chats, ["Jivo"]);
  assert.equal(page.canonical, "https://www.client.example/uslugi/");
  assert.equal(sameUrl(page.canonical || "", page.url), true);

  const bare = parsePage("<html><head><title>x</title></head></html>", "https://client.example/");
  assert.equal(bare.metrika, false);
  assert.equal(bare.canonical, "");
});

test("robots: Yandex group wins over *, Sitemap lines are collected", () => {
  const open = parseRobots("User-agent: *\nDisallow: /admin/\nSitemap: https://client.example/sitemap.xml");
  assert.deepEqual(open, { blocksYandex: false, sitemaps: ["https://client.example/sitemap.xml"] });
  assert.equal(parseRobots("User-agent: *\nDisallow: /").blocksYandex, true);
  assert.equal(parseRobots("User-agent: *\nDisallow: /\n\nUser-agent: Yandex\nDisallow: /tmp/").blocksYandex, false);
  assert.equal(parseRobots("User-agent: Yandex\nUser-agent: Googlebot\nDisallow: /").blocksYandex, true);
});

test("sitemap with another studio's domain is caught", () => {
  const xml = `<?xml version="1.0"?><urlset><url><loc>http://imdev.club/</loc></url></urlset>`;
  assert.deepEqual(parseSitemap(xml, "https://www.k-spec.ru/"), { index: false, locs: 1, foreignHosts: ["imdev.club"] });
  const own = `<urlset><url><loc>https://k-spec.ru/</loc></url><url><loc>https://www.k-spec.ru/uslugi</loc></url></urlset>`;
  assert.deepEqual(parseSitemap(own, "https://www.k-spec.ru/").foreignHosts, []);
  const facts = factsFromSiteFiles({
    robots: { url: "https://www.k-spec.ru/robots.txt", status: 200, found: true, blocksYandex: false, sitemaps: [] },
    sitemap: { url: "https://www.k-spec.ru/sitemap.xml", status: 200, found: true, index: false, locs: 1, foreignHosts: ["imdev.club"] },
  });
  assert.equal(facts[0].title, "robots.txt найден, сайт от Яндекса не закрыт");
  assert.match(facts[0].body, /Строки Sitemap в файле нет/);
  assert.equal(facts[1].title, "sitemap.xml ведёт на чужой домен");
  assert.match(facts[1].body, /imdev\.club/);
});

test("duplicate titles and Metrika missing on a page become facts", () => {
  const base = {
    status: 200,
    description: "",
    h1: "",
    headings: [],
    textExcerpt: "",
    hasForm: false,
    hasViewport: true,
    phones: [],
    emails: [],
    prices: [],
    ctas: [],
    elapsedMs: 50,
    canonical: "",
  };
  const facts = factsFromPages([
    { ...base, url: "https://client.example/", title: "Спецодежда", metrika: true, metrikaId: "123456" },
    { ...base, url: "https://client.example/uslugi", title: "Спецодежда", metrika: false },
  ]);
  const dupes = facts.find((fact) => fact.title === "Одинаковый title на нескольких страницах");
  assert.match(dupes?.body || "", /client\.example\/uslugi/);
  const metrika = facts.find((fact) => fact.title === "Счётчик Яндекс.Метрики найден");
  assert.match(metrika?.body || "", /123456/);
  assert.match(metrika?.body || "", /Нет на https:\/\/client\.example\/uslugi/);
  assert.equal(facts.find((fact) => fact.title.startsWith("Canonical"))?.title, "Canonical есть не на всех страницах");
});
