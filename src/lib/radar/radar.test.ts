import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSearchHits } from "./hh";
import { parseRadarTap } from "./actions-parse";
import { aiTitleOk, isVideoVacancy, passesHardFilter, tildaTitleOk, webTitleOk } from "./filter";
import { formatEveningReport, formatMorningReport, sourceCounts } from "./day-report";
import {
  canPushVacancy,
  fewResponses,
  responsesLabel,
  shouldSendDigest,
  shouldSendEveningReport,
  shouldSendMorningReport,
  worthInstantPush,
} from "./responses";
import { allocatePushSlots } from "./tracks";
import { scoreMatch } from "./match";
import { salaryBelowFloor } from "./money";
import { freshness, inQuietHours } from "./time";
import { rabotaSignature } from "./rabota-oauth";
import { parseRabotaVacancies, rabotaPublishedAt } from "./rabota";
import { parseTrudvsemVacancies, textSaysRemote, trudPublishedAt } from "./trudvsem";
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

  it("низкая зарплата остаётся, офис и менеджер нет", () => {
    assert.equal(
      passesHardFilter({ ...vacancy, salaryFrom: 40000, salaryTo: 60000 }, profile).ok,
      true,
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

  it("пропускает графического дизайнера маркетплейсов и режет менеджера", () => {
    const graphic = passesHardFilter(
      {
        ...vacancy,
        title: "Графический дизайнер (маркетплейсы)",
        description: "Инфографика и карточки товаров для Ozon",
      },
      profile,
    );
    assert.equal(graphic.ok, true);
    assert.equal(
      passesHardFilter({ ...vacancy, title: "Менеджер маркетплейса Ozon" }, profile).ok,
      false,
    );
  });

  it("тильда и визуальный ии проходят, продажи и админ сайта нет", () => {
    const tilda = {
      ...vacancy,
      title: "Разработчик сайтов (Tilda/WordPress/Битрикс)",
      salaryFrom: null,
      salaryTo: null,
    };
    assert.equal(tildaTitleOk(tilda.title), true);
    assert.equal(passesHardFilter(tilda, { ...profile, requireSalary: false }, "tilda").ok, true);
    assert.equal(tildaTitleOk("Администратор сайта-афиши на Tilda"), false);
    assert.equal(aiTitleOk("AI-креатор / Дизайнер"), true);
    assert.equal(aiTitleOk("ИИ-монтажёр для продвижения продукта"), false);
    assert.equal(isVideoVacancy("AI-креатор видеоконтента"), true);
    assert.equal(aiTitleOk("AI-креатор видеоконтента"), false);
    assert.equal(aiTitleOk("Менеджер по продажам обучения по Нейросетям"), false);
    assert.equal(aiTitleOk("Продуктовый дизайнер Middle+ / UX/UI в AI-сервис"), false);
    assert.equal(aiTitleOk("AI-креатор (Adult)"), false);
    assert.equal(aiTitleOk("Fullstack Software Engineer (AI & Video / Agents)"), false);
    assert.equal(
      passesHardFilter({ ...vacancy, title: "AI-дизайнер обложек", salaryFrom: 20000, salaryTo: 25000 }, profile, "ai").ok,
      true,
    );
    assert.equal(webTitleOk("Веб-разработчик"), true);
    assert.equal(webTitleOk("AI Engineer"), true);
    assert.equal(webTitleOk("Java-разработчик"), false);
    assert.equal(webTitleOk("Разработчик 1С"), false);
    assert.equal(webTitleOk("Системный администратор"), true);
    assert.equal(webTitleOk("Поддержка сайтов"), true);
    assert.equal(webTitleOk("Создание сайтов"), true);
    assert.equal(webTitleOk("DevOps инженер"), true);
    assert.equal(webTitleOk("Специалист по нейросетям"), true);
    assert.equal(webTitleOk("Инженер по искусственному интеллекту"), true);
    assert.equal(webTitleOk("Менеджер по продажам нейросетей"), false);
    assert.equal(webTitleOk("Администратор магазина"), false);
    assert.equal(
      passesHardFilter({ ...vacancy, title: "Веб-разработчик сайтов", remote: true }, profile, "web").ok,
      true,
    );
    assert.equal(
      passesHardFilter({ ...vacancy, title: "Веб-разработчик сайтов", remote: false }, profile, "web").ok,
      false,
    );
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
    assert.equal(fewResponses(3), true);
    assert.equal(fewResponses(4), false);
    assert.equal(fewResponses(null), true);
    assert.equal(responsesLabel(1), "1 отклик");
    assert.equal(responsesLabel(2), "2 отклика");
    assert.equal(responsesLabel(11), "11 откликов");
  });

  it("пуш только за сегодня и не больше 3 откликов", () => {
    const now = new Date("2026-10-06T06:00:00Z");
    assert.equal(
      worthInstantPush({
        publishedAt: new Date("2026-10-06T04:00:00Z"),
        firstSeenAt: now,
        responsesCount: 3,
        now,
      }),
      true,
    );
    assert.equal(
      worthInstantPush({
        publishedAt: new Date("2026-10-06T04:00:00Z"),
        firstSeenAt: now,
        responsesCount: 4,
        now,
      }),
      false,
    );
    assert.equal(
      worthInstantPush({
        publishedAt: new Date("2026-10-05T06:00:00Z"),
        firstSeenAt: now,
        responsesCount: 1,
        now,
      }),
      false,
    );
    assert.equal(
      worthInstantPush({
        publishedAt: new Date("2026-09-24T06:00:00Z"),
        firstSeenAt: now,
        responsesCount: 1922,
        now,
      }),
      false,
    );
    assert.equal(
      worthInstantPush({
        publishedAt: new Date("2026-10-06T05:30:00Z"),
        firstSeenAt: new Date("2026-10-06T05:40:00Z"),
        responsesCount: 2,
        now,
      }),
      true,
    );
  });

  it("без зарплаты пуш только при малом числе откликов", () => {
    const now = new Date("2026-10-06T06:00:00Z");
    assert.equal(
      canPushVacancy({
        publishedAt: new Date("2026-10-06T04:00:00Z"),
        firstSeenAt: now,
        responsesCount: 3,
        salaryFrom: null,
        salaryTo: null,
        now,
      }),
      true,
    );
    assert.equal(
      canPushVacancy({
        publishedAt: new Date("2026-10-06T04:00:00Z"),
        firstSeenAt: now,
        responsesCount: 4,
        salaryFrom: null,
        salaryTo: null,
        now,
      }),
      false,
    );
  });

  it("слоты потоков: квота, потом остаток другому", () => {
    const item = (track: "cards" | "tilda" | "ai" | "web", n: number) => ({ track, n });
    const pending = [
      ...Array.from({ length: 10 }, (_, i) => item("cards", i)),
      ...Array.from({ length: 2 }, (_, i) => item("tilda", i)),
      item("ai", 0),
    ];
    const picked = allocatePushSlots(pending, 15, { cards: 0, tilda: 0, ai: 0, web: 0 });
    assert.equal(picked.filter((row) => row.track === "cards").length, 10);
    assert.equal(picked.filter((row) => row.track === "tilda").length, 2);
    assert.equal(picked.filter((row) => row.track === "ai").length, 1);
    const rest = allocatePushSlots(pending, 7, { cards: 8, tilda: 0, ai: 0, web: 0 });
    assert.equal(rest.filter((row) => row.track === "cards").length, 4);
    assert.equal(rest.filter((row) => row.track === "tilda").length, 2);
    assert.equal(rest.filter((row) => row.track === "ai").length, 1);
  });

  it("утренний разбор только в первые 20 минут девятого часа", () => {
    const morning = new Date("2026-10-06T05:05:00Z");
    const later = new Date("2026-10-06T05:30:00Z");
    assert.equal(shouldSendDigest(morning, null), true);
    assert.equal(shouldSendDigest(later, null), false);
    assert.equal(shouldSendDigest(morning, new Date("2026-10-06T05:01:00Z")), false);
  });

  it("вечерний отчёт в тихие часы и не среди дня, утро — с 8 до 9", () => {
    const afternoon = new Date("2026-10-08T12:00:00+03:00");
    const evening = new Date("2026-10-08T23:10:00+03:00");
    const afterEvening = new Date("2026-10-08T23:20:00+03:00");
    const nextMorning = new Date("2026-10-09T08:20:00+03:00");
    assert.equal(shouldSendEveningReport(afternoon, null), false);
    assert.equal(shouldSendEveningReport(evening, null), true);
    assert.equal(shouldSendEveningReport(afterEvening, evening), false);
    assert.equal(shouldSendEveningReport(nextMorning, new Date("2026-10-07T23:10:00+03:00")), true);
    assert.equal(shouldSendMorningReport(new Date("2026-10-09T08:10:00+03:00"), null), true);
    assert.equal(shouldSendMorningReport(new Date("2026-10-09T09:10:00+03:00"), null), false);
    assert.equal(shouldSendMorningReport(new Date("2026-10-09T08:15:00+03:00"), new Date("2026-10-09T08:05:00+03:00")), false);
  });

  it("утренний и вечерний текст называют источники и числа", () => {
    const counts = sourceCounts(
      [
        { source: "hh", count: 2 },
        { source: "rabota", count: 1 },
      ],
      [{ source: "hh", count: 1 }],
    );
    const morning = formatMorningReport(
      [
        { source: "hh", label: "HH", ok: true, detail: "отвечает" },
        { source: "trudvsem", label: "Работа России", ok: false, detail: "Работа России 503" },
        { source: "rabota", label: "Работа.ру", ok: true, detail: "отвечает" },
      ],
      counts,
    );
    assert.match(morning, /С полуночи в ленте: 3/);
    assert.match(morning, /В Telegram ушло: 1/);
    assert.match(morning, /Есть проблема с источником/);
    const evening = formatEveningReport(counts, 4, []);
    assert.match(evening, /За день в ленте: 3/);
    assert.match(evening, /Карточки в чате удалены: 4/);
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

describe("rabota oauth", () => {
  it("подпись совпадает с примером из документации", () => {
    const sign = rabotaSignature(
      {
        app_id: "3803",
        time: "1551787641",
        code: "3MS3zSsNkyBG1gDlLiApdE7KAOQnG1b0",
      },
      "74JbXYMUR306MHTz0VnCiU5prNv3lO7f",
    );
    assert.equal(sign, "8d240c87e944740862b3ebd261ceb6db555268f59b421ffdee012f7737bc2855");
  });
});

describe("trudvsem", () => {
  const now = new Date("2026-10-08T09:00:00+03:00");

  it("удалёнка по тексту, не промплощадка и не отказ", () => {
    assert.equal(textSaysRemote("Удалённая работа, дизайнер карточек"), true);
    assert.equal(textSaysRemote("формат: дистанционно"), true);
    assert.equal(textSaysRemote("можно удаленно или в офисе"), true);
    assert.equal(textSaysRemote("Не удаленная работа, офис в Кирове"), false);
    assert.equal(textSaysRemote("Участок сварочно-монтажных работ удаленной промплощадки"), false);
    assert.equal(textSaysRemote("занятый на удалении золы"), false);
  });

  it("в ленту только создание сегодня, не правка старой", () => {
    assert.ok(trudPublishedAt("2026-10-08", now));
    assert.equal(trudPublishedAt("2026-04-27", now), null);
    const hits = parseTrudvsemVacancies(
      {
        results: {
          vacancies: [
            {
              vacancy: {
                id: "abc",
                "job-name": "Веб-разработчик (удаленно)",
                "creation-date": "2026-10-08",
                vac_url: "https://trudvsem.ru/vacancy/card/1/abc",
                salary_min: 80000,
                salary_max: 0,
                schedule: "Полный рабочий день",
                duty: "Сайты и лендинги. Удаленная работа.",
                company: { companycode: "1", name: "ООО Ромашка" },
                region: { name: "Москва" },
              },
            },
            {
              vacancy: {
                id: "old",
                "job-name": "Дизайнер",
                "creation-date": "2026-04-27",
                date_modify: "2026-10-08T11:00:00+0300",
                duty: "удаленно",
                company: { companycode: "2", name: "Старая" },
              },
            },
          ],
        },
      },
      now,
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0].id, "1/abc");
    assert.equal(hits[0].remote, true);
    assert.equal(hits[0].salaryFrom, 80000);
    assert.equal(hits[0].salaryTo, null);
    assert.equal(hits[0].area, "Москва");
  });
});

describe("rabota", () => {
  const now = new Date("2026-10-08T12:00:00+03:00");

  it("в ленту только сегодняшняя удалёнка, не правка старой и не офис", () => {
    assert.ok(rabotaPublishedAt("2026-10-08T10:22:37+03:00", now));
    assert.equal(rabotaPublishedAt("2026-10-07T18:00:00+03:00", now), null);
    const hits = parseRabotaVacancies(
      {
        response: {
          vacancies: [
            {
              id: 54432848,
              title: "Веб-разработчик",
              publish_start_at: "2026-10-08T10:22:37+03:00",
              modified_date: "2026-10-08T11:00:00+0300",
              description: "<p>Сайты и лендинги.</p>",
              operating_schedule: { id: 6, name: "удаленная работа" },
              salary: { from: 80000, to: 120000, currency: "руб./мес." },
              company: { name: "ООО Ромашка", slug: "romashka" },
              places: [{ name: "г Казань", region: { name: "Казань" } }],
            },
            {
              id: 1,
              title: "Старая, но обновлённая",
              publish_start_at: "2026-09-01T10:00:00+03:00",
              modified_date: "2026-10-08T11:00:00+0300",
              operating_schedule: { id: 6, name: "удаленная работа" },
            },
            {
              id: 2,
              title: "Офис сегодня",
              publish_start_at: "2026-10-08T09:00:00+03:00",
              operating_schedule: { id: 1, name: "полный рабочий день" },
              places: [{ region: { name: "Москва" } }],
            },
          ],
        },
      },
      now,
    );
    assert.equal(hits.length, 2);
    assert.equal(hits[0].id, "54432848");
    assert.equal(hits[0].remote, true);
    assert.equal(hits[0].salaryFrom, 80000);
    assert.equal(hits[0].salaryCurrency, "RUR");
    assert.equal(hits[0].area, "Казань");
    assert.equal(hits[0].url, "https://www.rabota.ru/vacancy/54432848/");
    assert.equal(hits[1].remote, false);
  });
});
