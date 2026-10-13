import assert from "node:assert/strict";
import test from "node:test";
import { factsFromPages, isPrivateIp, parsePage, pickInternalLinks, pricesInText, type PageSnapshot } from "./fetch-site";
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
