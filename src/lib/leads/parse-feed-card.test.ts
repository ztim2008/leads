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
    assert.equal(p.author, "Виктор");
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
    assert.equal(p.author, "Денис Халаев");
  });

  it("SPb in prose", () => {
    const p = parseFeedCard("Сайтерам, проживающим в Санкт-Петербурге! Задача собрать каркас");
    assert.equal(p.city, "Санкт-Петербург");
  });

  it("matched keyword", () => {
    assert.equal(matchedKeyword("Нужен сантехник срочно", "электрик, сантехник"), "сантехник");
  });

  it("task snippet + author from pilot feed", () => {
    const desc = `12 минут назад
Создание сайтов
до 40 000 ₽
до40 000 ₽
Доска объявлений · Платформа: по рекомендации специалиста · Функционал сайта: Возможность написать специалисту и т.д · Контента нет · Пожелания и особенности: В общем, нужно 4 сайта: психологи, репетиторы, тарологи и помощь студентам · Важно: управлять сайтами должна только я, а именно редактировать анкеты, удалять, добавлять и отвечать на сообщения. Пишите свои идеи
Дистанционно · Москва
 -3 часа`;
    const p = parseFeedCard(desc, "Создание сайтов");
    assert.ok(p.taskSnippet);
    assert.match(p.taskSnippet!, /4 сайта|психолог/i);
    assert.doesNotMatch(p.taskSnippet!, /дистанционн|40.?000|12 минут/i);
  });

  it("author + reviews + newbie", () => {
    const p = parseFeedCard(
      `Ремонт смесителя\nдо 3000 ₽\nАнна\nОставила 12 отзывов\nДистанционно · Москва\n5 минут назад`,
      "Ремонт смесителя",
    );
    assert.equal(p.author, "Анна");
    assert.equal(p.reviewCount, 12);
    assert.equal(p.newbie, false);
  });

  it("response price variants from feed", () => {
    assert.equal(parseFeedCard("Стоимость отклика: 450 ₽").responsePrice, 450);
    assert.equal(parseFeedCard("Отклик за 1 200 ₽").responsePrice, 1200);
    assert.equal(parseFeedCard("700 ₽ за отклик").responsePrice, 700);
  });

  it("newbie flag", () => {
    const p = parseFeedCard("Создание сайта\nНовый клиент\nМосква\nтолько что", "Создание сайта");
    assert.equal(p.newbie, true);
    assert.ok(p.riskHint);
  });
});

describe("formatLeadTelegram v5.1", () => {
  it("shows task + author", () => {
    const t = formatLeadTelegram({
      platform: "profi",
      title: "Создание сайтов",
      budget: "до 40 000 ₽",
      url: "https://profi.ru/x",
      city: "Москва",
      remote: true,
      ageLabel: "12 мин",
      matchedKeyword: "сайт",
      taskSnippet:
        "Нужно 4 сайта: психологи, репетиторы, тарологи. Управлять анкетами должна только заказчица.",
      author: "Князь",
      newbie: true,
      riskHint: "возможный новичок — чаще фейки",
    });
    assert.match(t, /📌|🔥/);
    assert.match(t, /до 40 000/);
    assert.match(t, /4 сайта/);
    assert.match(t, /👤 Князь/);
    assert.match(t, /новичок/);
    assert.match(t, /⚠/);
    assert.match(t, /Цена отклика: не показана в ленте/);
    assert.match(t, /📝 <b>Задача<\/b>/);
    assert.doesNotMatch(t, /ГОРЯЧИЙ ЛИД|━━━|избранное/i);
  });

  it("one-screen card still hot", () => {
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
      taskSnippet: "Течёт под раковиной, нужен мастер сегодня.",
      author: "Игорь",
      reviewCount: 8,
    });
    assert.match(t, /🔥/);
    assert.match(t, /Течёт под раковиной/);
    assert.match(t, /⭐ 8 отз/);
  });

  it("puts task parts on separate lines and shows response price", () => {
    const t = formatLeadTelegram({
      platform: "profi",
      title: "Создание сайта",
      budget: "до 50 000 ₽",
      url: "https://profi.ru/x",
      responsePrice: 490,
      taskSnippet: "Платформа: Tilda · Контент есть · Нужен лендинг",
    });
    assert.match(t, /Цена отклика: 490 ₽/);
    assert.match(t, /Платформа: Tilda\nКонтент есть\nНужен лендинг/);
  });
});
