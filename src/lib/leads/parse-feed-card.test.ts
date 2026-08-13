import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFeedCard, matchedKeyword } from "./parse-feed-card";
import { formatLeadTelegram } from "@/lib/telegram/notifications";

describe("parseFeedCard", () => {
  it("budget до + city Москва + age", () => {
    const t = `Создание сайта-визитки
до 5000 ₽
до5000 ₽
Дистанционно · Москва
Виктор
16 минут назад`;
    const p = parseFeedCard(t, "Создание сайта-визитки");
    assert.equal(p.budgetMax, 5000);
    assert.equal(p.budgetMin, 5000);
    assert.match(p.budgetLabel || "", /до 5 000/);
    assert.equal(p.city, "Москва");
    assert.equal(p.remote, true);
    assert.equal(p.ageMinutes, 16);
  });

  it("large budget nbsp", () => {
    const p = parseFeedCard("Создание сайта на Tilda\nдо 200 000 ₽\nДистанционно · Москва\n4 минуты назад");
    assert.equal(p.budgetMax, 200000);
    assert.equal(p.city, "Москва");
    assert.equal(p.ageMinutes, 4);
  });

  it("otkliki + client hint", () => {
    const p = parseFeedCard("Сайты создание\nДистанционно · Москва\nДенис Халаев\nКлиент изучает цены\nТолько что\n3 отклика");
    assert.equal(p.responses, 3);
    assert.equal(p.clientHint, "изучает цены");
    assert.equal(p.ageMinutes, 0);
    assert.equal(p.ageLabel, "только что");
  });

  it("SPb in prose", () => {
    const p = parseFeedCard("Сайтерам, проживающим в Санкт-Петербурге! Задача собрать каркас");
    assert.equal(p.city, "Санкт-Петербург");
  });

  it("matched keyword", () => {
    assert.equal(matchedKeyword("Нужен сантехник срочно", "электрик, сантехник"), "сантехник");
  });
});

describe("formatLeadTelegram v5", () => {
  it("one-screen card", () => {
    const t = formatLeadTelegram({
      platform: "profi",
      title: "Сантехник · протечка",
      budget: "до 8 000 ₽",
      url: "https://profi.ru/x",
      city: "Москва",
      remote: false,
      responses: 1,
      ageLabel: "только что",
      matchedKeyword: "сантехник",
    });
    assert.match(t, /🔥/);
    assert.match(t, /до 8 000/);
    assert.match(t, /Москва/);
    assert.match(t, /1 откл/);
    assert.doesNotMatch(t, /ГОРЯЧИЙ ЛИД|━━━|избранное/i);
  });
});
