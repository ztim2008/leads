import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  flCategoryPasses,
  isFlOrder,
  parseFlBudget,
  parseFlCategory,
  parseFlDescription,
  parseFlList,
  parseFlResponses,
} from "./fl";
import { formatLeadTelegram } from "@/lib/telegram/notifications";

const card = (id: string, title: string, price: string, kind: string, answers: string) => `
<div data-id="qa-lenta-1" class="b-post" id="project-item${id}" >
  <h2 class="text-h5 b-post__title"><a class="text-dark" id="prj_name_${id}" name="prj${id}" href="/projects/${id}/slug.html">${title}</a></h2>
  <div class="d-flex b-post__price p-0"><span class="text-4">${price}</span></div>
  <div class="b-post__body"><div class="b-post__txt text-5 ">Нужно сделать:&nbsp; сайт на Tilda...</div></div>
  <span class="b-post__bold b-layout__txt_inline-block text-7 text-dark mr-4">${kind}</span>
  <span class="text-gray-opacity-4 text-7 mr-16">4 минуты назад</span>
  <span data-id="fl-view-count-href"><svg width="16" height="15"><use xlink:href="#message-empty"></use></svg>
    ${answers}  </span>
</div>`;

describe("FL.ru list parser", () => {
  const html =
    card("5527507", "Сайт &amp; лендинг", "200&nbsp;000&nbsp;<span class=\"fl-rub\"><span class=\"d-none\">&#8381;</span></span>", "Заказ", "3 ответа") +
    card("5527505", "Менеджер", "по результатам собеседования", "Вакансия&nbsp;(Россия)", "Нет ответов");

  it("reads id, title, url, budget, age, responses", () => {
    const [a, b] = parseFlList(html);
    assert.equal(a.id, "5527507");
    assert.equal(a.title, "Сайт & лендинг");
    assert.equal(a.url, "https://www.fl.ru/projects/5527507/slug.html");
    assert.equal(a.budgetMin, 200000);
    assert.equal(a.ageLabel, "4 минуты назад");
    assert.equal(a.responses, 3);
    assert.match(a.snippet, /^Нужно сделать: сайт на Tilda/);
    assert.ok(isFlOrder(a));
    assert.equal(b.responses, 0);
    assert.equal(b.budgetMin, undefined);
    assert.ok(!isFlOrder(b));
  });

  it("budget ranges and «от»", () => {
    assert.deepEqual(parseFlBudget("3 000 ₽ – 5 500 ₽"), { min: 3000, max: 5500 });
    assert.deepEqual(parseFlBudget("от 1 000 ₽"), { min: 1000, max: 1000 });
    assert.deepEqual(parseFlBudget("по договоренности"), {});
    assert.equal(parseFlResponses("581 ответ"), 581);
    assert.equal(parseFlResponses(undefined), null);
  });

  it("full description from project page", () => {
    const page = `<div id="projectp5527507" class="text-5 pb-20 fl-project-content__description-text "> Нужно сделать:<br/>Лендинг&nbsp;под Директ </div>`;
    assert.equal(parseFlDescription(page, "5527507"), "Нужно сделать:\nЛендинг под Директ");
    assert.equal(parseFlDescription("<div></div>", "1"), null);
  });
});

describe("FL.ru category filter", () => {
  const ga = (p: string) => `data-ga-event="{&quot;ea&quot;:&quot;click_path_in_projects&quot;}" data-ga-on="click" href="https://www.fl.ru/projects/category/${p}"`;
  const page = `<nav><a href="/projects/category/saity/">Сайты</a></nav>
    <a ${ga("programmirovanie/")} class="text-blue">Программирование</a>
    <a ${ga("programmirovanie/parsing-dannyih/")} class="text-blue">Парсинг</a>`;
  const cfg = { flCategories: ["saity"], flExcludeSubcategories: ["web-dizajner-razrabotka-sajtov"] };

  it("reads category and subcategory", () => {
    assert.deepEqual(parseFlCategory(page), { category: "programmirovanie", subcategory: "parsing-dannyih" });
    assert.equal(parseFlCategory("<div></div>"), null);
  });

  it("allows only listed categories, minus excluded subcategories", () => {
    assert.ok(!flCategoryPasses(parseFlCategory(page), cfg));
    assert.ok(flCategoryPasses({ category: "saity", subcategory: "tilda" }, cfg));
    assert.ok(flCategoryPasses({ category: "saity", subcategory: null }, cfg));
    assert.ok(!flCategoryPasses({ category: "saity", subcategory: "web-dizajner-razrabotka-sajtov" }, cfg));
    assert.ok(flCategoryPasses(null, cfg));
    assert.ok(flCategoryPasses({ category: "games", subcategory: null }, {}));
  });
});

describe("FL.ru telegram card", () => {
  it("marks FL.ru in the header line and button", () => {
    const text = formatLeadTelegram({
      title: "Лендинг", budget: "по договоренности", url: "https://www.fl.ru/projects/1/x.html",
      platform: "fl", responses: 0, replyTexts: [{ name: "A", text: "x" }],
    });
    assert.match(text.split("\n")[0], /^🟦 <b>FL\.ru<\/b> · /);
    assert.match(text, /вставьте на FL\.ru/);
  });
});
