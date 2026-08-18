import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listHasMatch, listHitsMinus, stemRu, textHasTerm } from "./ru-stem";

describe("stemRu", () => {
  it("сайт / сайты / сайтов / сайтами — один корень", () => {
    const stems = ["сайт", "сайты", "сайтов", "сайтами", "сайте", "сайта"].map(stemRu);
    assert.equal(new Set(stems).size, 1);
    assert.equal(stems[0], "сайт");
  });
});

describe("textHasTerm", () => {
  it("ловлет склонения «сайт»", () => {
    assert.equal(textHasTerm("Нужны сайты под ключ", "сайт"), true);
    assert.equal(textHasTerm("Разработка сайтов", "сайт"), true);
    assert.equal(textHasTerm("Помогите с сайтами", "сайт"), true);
    assert.equal(textHasTerm("Ремонт квартиры", "сайт"), false);
  });

  it("ловлет курсовая / курсовой / курсовую", () => {
    assert.equal(textHasTerm("Нужен курсовой проект", "курсовая"), true);
    assert.equal(textHasTerm("Сделать курсовую", "курсовая"), true);
    assert.equal(textHasTerm("Диплом без сайта", "курсовая"), false);
  });

  it("тильда / тильде / tilda", () => {
    assert.equal(textHasTerm("Сайт на тильде", "тильда"), true);
    assert.equal(textHasTerm("Нужен tilda лендинг", "tilda"), true);
  });

  it("фраза из нескольких слов", () => {
    assert.equal(textHasTerm("Нужно создание сайтов", "создание сайта"), true);
    assert.equal(textHasTerm("Только логотип", "создание сайта"), false);
  });
});

describe("plus / minus lists", () => {
  it("пустой плюс — всё проходит, пустой минус — никого не режет", () => {
    assert.equal(listHasMatch("любой текст", ""), true);
    assert.equal(listHitsMinus("курсовая работа", ""), false);
  });

  it("минус ловит склонение", () => {
    assert.equal(listHitsMinus("Нужен курсовой", "курсовая, студент"), true);
  });
});
