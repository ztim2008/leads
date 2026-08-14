import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { genderFromName, passesGenderFilter } from "./name-gender";
import { budgetPasses, isWithinPartnerHours, parsePartnerFilters } from "./partner-filters";

describe("genderFromName", () => {
  it("male and female from first name", () => {
    assert.equal(genderFromName("Денис Халаев"), "male");
    assert.equal(genderFromName("Анна"), "female");
    assert.equal(genderFromName("Виктор"), "male");
    assert.equal(genderFromName("Мария"), "female");
  });

  it("ambiguous and missing", () => {
    assert.equal(genderFromName("Саша"), "unknown");
    assert.equal(genderFromName("Князь"), "unknown");
    assert.equal(genderFromName(""), "unknown");
  });

  it("filter drops unknown when sex selected", () => {
    assert.equal(passesGenderFilter("Анна", "female"), true);
    assert.equal(passesGenderFilter("Анна", "male"), false);
    assert.equal(passesGenderFilter("Саша", "male"), false);
    assert.equal(passesGenderFilter("Саша", "all"), true);
  });
});

describe("parsePartnerFilters", () => {
  it("clamps hours to 08–22", () => {
    const f = parsePartnerFilters({ workHoursStart: "06:00", workHoursEnd: "23:30" });
    assert.equal(f.workHoursStart, "08:00");
    assert.equal(f.workHoursEnd, "22:00");
  });

  it("budget without amount respects showNoBudget", () => {
    assert.equal(budgetPasses(null, { budgetMin: 5000, budgetMax: 100000, showNoBudget: true }), true);
    assert.equal(budgetPasses(null, { budgetMin: 5000, budgetMax: 100000, showNoBudget: false }), false);
    assert.equal(budgetPasses(3000, { budgetMin: 5000, budgetMax: 100000, showNoBudget: true }), false);
    assert.equal(budgetPasses(8000, { budgetMin: 5000, budgetMax: 100000, showNoBudget: true }), true);
  });

  it("work hours window", () => {
    const morning = new Date("2026-08-14T05:00:00Z"); // 08:00 MSK
    const night = new Date("2026-08-14T20:00:00Z"); // 23:00 MSK
    assert.equal(isWithinPartnerHours("08:00", "22:00", morning), true);
    assert.equal(isWithinPartnerHours("08:00", "22:00", night), false);
  });
});
