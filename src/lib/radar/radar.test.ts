import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSearchHits } from "./hh";
import { parseRadarTap } from "./actions-parse";
import { passesHardFilter } from "./filter";
import { fewResponses, responsesLabel, shouldSendDigest } from "./responses";
import { scoreMatch } from "./match";
import { salaryBelowFloor } from "./money";
import { freshness, inQuietHours } from "./time";
import { buildTrustChecks, trustScore } from "./trust";

const profile = {
  salaryMin: 70000,
  requireSalary: true,
  remoteOnly: true,
  directions: ["Ozon", "Карточки товаров"],
  skills: ["инфографика"],
  exclusions: ["программирование", "frontend", "офис", "продажи"],
  specialization: "AI-дизайнер / AI-креатор",
};

const vacancy = {
  title: "Дизайнер карточек товаров для Ozon",
  description: "Нужна инфографика и карточки для маркетплейса. Удалённо, долго.",
  salaryFrom: 80000,
  salaryTo: 100000,
  salaryCurrency: "RUR",
  remote: true,
};

describe("job radar filter", () => {
  it("пропускает удалённую вакансию по профилю", () => {
    const decision = passesHardFilter(vacancy, profile);
    assert.equal(decision.ok, true);
  });

  it("отсекает зарплату ниже порога и офис", () => {
    assert.equal(
      passesHardFilter({ ...vacancy, salaryFrom: 40000, salaryTo: 60000 }, profile).ok,
      false,
    );
    assert.equal(passesHardFilter({ ...vacancy, remote: false }, profile).ok, false);
    assert.equal(
      passesHardFilter({ ...vacancy, title: "Менеджер по работе с Wildberries" }, profile).ok,
      false,
    );
  });

  it("отсекает разработку по заголовку и не режет дизайн из-за слова в описании", () => {
    assert.equal(
      passesHardFilter({ ...vacancy, title: "Frontend-разработчик React" }, profile).ok,
      false,
    );
    const withTeam = passesHardFilter(
      {
        ...vacancy,
        description: vacancy.description + " В команде есть разработчики, общаться с ними нужно.",
      },
      profile,
    );
    assert.equal(withTeam.ok, true);
  });
});

describe("job radar scores", () => {
  it("совпадение растёт от попаданий в профиль", () => {
    const score = scoreMatch({
      ...vacancy,
      employment: "Полная занятость",
      directions: profile.directions,
      skills: profile.skills,
      salaryMin: profile.salaryMin,
    });
    assert.ok(score.score >= 85);
    assert.ok(score.reasons.some((r) => /ozon/i.test(r)));
  });

  it("надёжность — доля выполненных проверок", () => {
    const checks = buildTrustChecks({
      company: "Ozon",
      employerTrusted: true,
      employerVacancyCount: 4,
      publishedAt: new Date(),
      salaryFrom: 80000,
      salaryTo: 100000,
      description: "а".repeat(500),
    });
    assert.equal(trustScore(checks), 100);
    assert.equal(salaryBelowFloor(50000, 60000, "RUR", 70000), true);
    assert.equal(salaryBelowFloor(55000, 80000, "RUR", 70000), false);
    assert.equal(salaryBelowFloor(null, null, "RUR", 70000), null);
  });
});

describe("job radar hh page", () => {
  it("читает вакансию из состояния страницы и берёт дату создания", () => {
    const html = `<template id="HH-Lux-InitialState">{&#34;vacancySearchResult&#34;:{&#34;vacancies&#34;:[{&#34;vacancyId&#34;:1,&#34;name&#34;:&#34;Дизайнер карточек&#34;,&#34;@workSchedule&#34;:&#34;remote&#34;,&#34;company&#34;:{&#34;@trusted&#34;:true,&#34;id&#34;:5,&#34;name&#34;:&#34;Ozon&#34;},&#34;compensation&#34;:{&#34;from&#34;:80000,&#34;currencyCode&#34;:&#34;RUR&#34;,&#34;gross&#34;:false},&#34;area&#34;:{&#34;name&#34;:&#34;Москва&#34;},&#34;creationTime&#34;:&#34;2026-10-05T18:00:00+03:00&#34;,&#34;publicationTime&#34;:{&#34;$&#34;:&#34;2026-10-05T22:00:00+03:00&#34;},&#34;employmentForm&#34;:&#34;FULL&#34;,&#34;workFormats&#34;:[&#34;REMOTE&#34;],&#34;links&#34;:{&#34;desktop&#34;:&#34;https://hh.ru/vacancy/1&#34;}}]}}</template>`;
    const [hit] = parseSearchHits(html);
    assert.equal(hit.title, "Дизайнер карточек");
    assert.equal(hit.company, "Ozon");
    assert.equal(hit.remote, true);
    assert.equal(hit.trusted, true);
    assert.equal(hit.salaryFrom, 80000);
    assert.equal(hit.publishedAt, "2026-10-05T18:00:00+03:00");
    assert.equal(hit.employment, "Полная занятость");
  });
});

describe("job radar replies and digest", () => {
  it("мало откликов и подписи", () => {
    assert.equal(fewResponses(1), true);
    assert.equal(fewResponses(5), true);
    assert.equal(fewResponses(12), false);
    assert.equal(fewResponses(null), true);
    assert.equal(responsesLabel(1), "1 отклик");
    assert.equal(responsesLabel(2), "2 отклика");
    assert.equal(responsesLabel(11), "11 откликов");
  });

  it("утренний разбор только в первые 20 минут девятого часа", () => {
    const morning = new Date("2026-10-06T05:05:00Z");
    const later = new Date("2026-10-06T05:30:00Z");
    assert.equal(shouldSendDigest(morning, null), true);
    assert.equal(shouldSendDigest(later, null), false);
    assert.equal(shouldSendDigest(morning, new Date("2026-10-06T05:01:00Z")), false);
  });

  it("кнопки телеграма разбираются", () => {
    const id = "24fe85d0-2e95-4b48-a5ad-dad019c1681d";
    assert.equal(parseRadarTap(`reply:${id}`)?.type, "reply");
    assert.equal(parseRadarTap(`hide:pay:${id}`)?.type, "hide");
    assert.equal(parseRadarTap("hide:nope"), null);
  });
});

describe("job radar time", () => {
  it("тихие часы через полночь", () => {
    assert.equal(inQuietHours("23:00", "08:00", new Date("2026-10-05T20:30:00Z")), true);
    assert.equal(inQuietHours("23:00", "08:00", new Date("2026-10-05T16:00:00Z")), false);
  });

  it("свежесть горячая только если оба времени свежие", () => {
    const now = new Date("2026-10-05T19:00:00Z");
    const hot = freshness(new Date("2026-10-05T18:50:00Z"), new Date("2026-10-05T18:52:00Z"), now);
    assert.equal(hot.hot, true);
    const republish = freshness(new Date("2026-09-01T18:50:00Z"), new Date("2026-10-05T18:52:00Z"), now);
    assert.equal(republish.hot, false);
  });
});
