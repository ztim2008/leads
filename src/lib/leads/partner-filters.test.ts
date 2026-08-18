import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateLeadFilters,
  parsePartnerFilters,
  type PartnerFilters,
} from "./partner-filters";

const day = new Date("2026-08-18T07:00:00Z"); // 10:00 МСК
const night = new Date("2026-08-17T21:30:00Z"); // 00:30 МСК

function filters(partial: Partial<PartnerFilters> = {}): PartnerFilters {
  return {
    titleKeywords: "сайт",
    titleMinusKeywords: "",
    keywords: "лендинг",
    minusKeywords: "студент",
    budgetMin: 5000,
    budgetMax: 100000,
    showNoBudget: true,
    workHoursStart: "08:00",
    workHoursEnd: "22:00",
    clientGender: "all",
    ...partial,
  };
}

const base = { author: "Анна", budgetMin: 20000 };

describe("evaluateLeadFilters 4.10", () => {
  it("заголовок и текст фильтруются отдельно", () => {
    const ok = evaluateLeadFilters(
      { title: "Создание сайтов", description: "нужен лендинг на тильде", ...base },
      filters(),
      day,
    );
    const badTitle = evaluateLeadFilters(
      { title: "Ремонт квартиры", description: "нужен лендинг", ...base },
      filters(),
      day,
    );
    const badText = evaluateLeadFilters(
      { title: "Создание сайта", description: "только логотип", ...base },
      filters(),
      day,
    );
    assert.equal(ok.ok, true);
    assert.deepEqual(badTitle, { ok: false, reason: "title_plus" });
    assert.deepEqual(badText, { ok: false, reason: "text_plus" });
  });

  it("склонения: сайт в заголовке ловит сайты/сайтов/сайтами", () => {
    for (const title of ["Нужны сайты", "Разработка сайтов", "Помогите с сайтами"]) {
      const v = evaluateLeadFilters(
        { title, description: "сделать лендинг", ...base },
        filters(),
        day,
      );
      assert.equal(v.ok, true, title);
    }
  });

  it("минус заголовка не смотрит текст, минус текста не смотрит заголовок", () => {
    const titleMinus = evaluateLeadFilters(
      { title: "Сайт курсовой проект", description: "нужен лендинг", ...base },
      filters({ titleMinusKeywords: "курсовая", minusKeywords: "" }),
      day,
    );
    const textOnlyMinus = evaluateLeadFilters(
      { title: "Сайт курсовой проект", description: "нужен лендинг", ...base },
      filters({ titleMinusKeywords: "", minusKeywords: "курсовая" }),
      day,
    );
    const textMinusHit = evaluateLeadFilters(
      { title: "Создание сайта", description: "это курсовая и лендинг", ...base },
      filters({ titleMinusKeywords: "", minusKeywords: "курсовая" }),
      day,
    );
    assert.deepEqual(titleMinus, { ok: false, reason: "title_minus" });
    assert.equal(textOnlyMinus.ok, true);
    assert.deepEqual(textMinusHit, { ok: false, reason: "text_minus" });
  });

  it("hours: ночь 22–08 не проходит", () => {
    const atNight = evaluateLeadFilters(
      { title: "Сайт компании", description: "лендинг", ...base },
      filters(),
      night,
    );
    assert.deepEqual(atNight, { ok: false, reason: "hours" });
  });

  it("budget: вилка и «без бюджета»", () => {
    const low = evaluateLeadFilters(
      { title: "Сайт", description: "лендинг", author: "Анна", budgetMin: 1000 },
      filters(),
      day,
    );
    const noBudgetOff = evaluateLeadFilters(
      { title: "Сайт", description: "лендинг", author: "Анна", budgetMin: null },
      filters({ showNoBudget: false }),
      day,
    );
    const noBudgetOn = evaluateLeadFilters(
      { title: "Сайт", description: "лендинг", author: "Анна", budgetMin: null },
      filters({ showNoBudget: true }),
      day,
    );
    assert.deepEqual(low, { ok: false, reason: "budget" });
    assert.deepEqual(noBudgetOff, { ok: false, reason: "budget" });
    assert.equal(noBudgetOn.ok, true);
  });

  it("gender: явные имена режутся, Саша/Женя/пустое — fail при М/Ж", () => {
    const f = filters({ clientGender: "male" });
    const lead = { title: "Сайт", description: "лендинг", budgetMin: 20000 };
    assert.equal(evaluateLeadFilters({ ...lead, author: "Денис" }, f, day).ok, true);
    assert.deepEqual(evaluateLeadFilters({ ...lead, author: "Анна" }, f, day), { ok: false, reason: "gender" });
    assert.deepEqual(evaluateLeadFilters({ ...lead, author: "Саша" }, f, day), { ok: false, reason: "gender" });
    assert.deepEqual(evaluateLeadFilters({ ...lead, author: "Женя" }, f, day), { ok: false, reason: "gender" });
    assert.deepEqual(evaluateLeadFilters({ ...lead, author: "" }, f, day), { ok: false, reason: "gender" });
  });
});

describe("parsePartnerFilters", () => {
  it("не даёт выйти за 08–22", () => {
    const f = parsePartnerFilters({ workHoursStart: "06:00", workHoursEnd: "23:00" });
    assert.equal(f.workHoursStart, "08:00");
    assert.equal(f.workHoursEnd, "22:00");
  });
});
