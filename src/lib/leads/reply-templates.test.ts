import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCopyViaTelegramButton,
  fillAllReplyTemplates,
  fillReplyTemplate,
  parseReplyTemplates,
  sanitizeReplyTemplatesInput,
  serializeReplyTemplates,
  TG_COPY_TEXT_MAX,
} from "./reply-templates";
import { formatLeadTelegram } from "@/lib/telegram/notifications";

describe("reply-templates", () => {
  it("parses legacy plain string as one template", () => {
    const list = parseReplyTemplates("Здравствуйте, {имя}!");
    assert.equal(list.length, 1);
    assert.equal(list[0].name, "Основной");
    assert.match(list[0].body, /\{имя\}/);
  });

  it("parses JSON array and caps at 3", () => {
    const raw = serializeReplyTemplates([
      { id: "1", name: "A", body: "one {задача}" },
      { id: "2", name: "B", body: "two" },
      { id: "3", name: "C", body: "three" },
      { id: "4", name: "D", body: "four" },
    ]);
    const list = parseReplyTemplates(raw);
    assert.equal(list.length, 3);
    assert.equal(list[2].name, "C");
  });

  it("fills placeholders", () => {
    const text = fillReplyTemplate(
      "Привет, {имя}! Тема: {задача}. Город {город}. Бюджет {бюджет}. Цена {цена_отклика}.",
      {
        author: "Игорь",
        title: "Сайт на Тильде",
        city: "Москва",
        budget: "до 40 000 ₽",
        responsePrice: 490,
      },
    );
    assert.match(text, /Игорь/);
    assert.match(text, /Сайт на Тильде/);
    assert.match(text, /Москва/);
    assert.match(text, /40 000/);
    assert.match(text, /490/);
  });

  it("sanitize drops empty bodies", () => {
    const list = sanitizeReplyTemplatesInput([
      { name: "Пустой", body: "  " },
      { name: "Ок", body: "Текст" },
    ]);
    assert.equal(list.length, 1);
    assert.equal(list[0].name, "Ок");
  });

  it("copy button limit", () => {
    assert.equal(canCopyViaTelegramButton("короткий"), true);
    assert.equal(canCopyViaTelegramButton("x".repeat(TG_COPY_TEXT_MAX + 1)), false);
  });

  it("fillAll skips empty after fill", () => {
    const filled = fillAllReplyTemplates(
      [{ id: "1", name: "X", body: "{имя}" }],
      { author: "" },
    );
    assert.equal(filled.length, 0);
  });
});

describe("formatLeadTelegram reply block", () => {
  it("appends Текст отклика and pre", () => {
    const t = formatLeadTelegram({
      platform: "profi",
      title: "Создание сайтов",
      budget: "до 40 000 ₽",
      url: "https://profi.ru/x",
      replyTexts: [{ name: "Основной", text: "Здравствуйте! Готов сделать сайт." }],
    });
    assert.match(t, /Текст отклика/);
    assert.match(t, /<b>Основной<\/b>/);
    assert.match(t, /Готов сделать сайт/);
    assert.match(t, /Авто-отправки нет/);
  });
});
