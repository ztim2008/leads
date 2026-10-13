import assert from "node:assert/strict";
import test from "node:test";
import { SECTIONS_TITLE, landingMap, sectionsBody, siteSections } from "./landing";
import type { PresentFinding } from "./present";

const home = "https://www.k-spec.ru/";
const links = [
  { text: "Брюки", url: "https://www.k-spec.ru/katalog/bryuki" },
  { text: "Флисовые костюмы, куртки", url: "https://www.k-spec.ru/katalog/flisovye-kostyumy-kurtki" },
  { text: "Костюм флисовый БРИЗ", url: "https://www.k-spec.ru/katalog/flisovye-kostyumy-kurtki/kostyumy-iz-flisa/briz" },
  { text: "Куртка флисовая", url: "https://www.k-spec.ru/katalog/flisovye-kostyumy-kurtki/kurtki/universal" },
  { text: "Носки", url: "https://www.k-spec.ru/katalog/noski" },
  { text: "Носки флисовые", url: "https://www.k-spec.ru/katalog/noski/noski-flisovye/haki" },
  { text: "Политика конфиденциальности", url: "https://k-spec.ru/politika-konfidencialnosti" },
  { text: "Контакты", url: "https://www.k-spec.ru/kontakty" },
  { text: "Чужой", url: "https://other.example/katalog/x" },
];

test("menu sections become ad groups, products are counted, service pages are skipped", () => {
  const sections = siteSections(links, home);
  assert.deepEqual(
    sections.map((section) => [section.text, section.items]),
    [
      ["Флисовые костюмы, куртки", 2],
      ["Носки", 1],
      ["Брюки", 0],
    ],
  );
});

test("landing map joins sections with what was seen on studied pages", () => {
  const findings: PresentFinding[] = [
    {
      id: "1",
      kind: "fact",
      title: SECTIONS_TITLE,
      body: sectionsBody(siteSections(links, home)),
      evidenceUrl: home,
      evidenceQuote: "Брюки",
    },
    {
      id: "2",
      kind: "fact",
      title: "Заголовки изученных страниц",
      body: [
        "https://www.k-spec.ru/: title 89 знаков; H1 нет; описание 71 знаков",
        "https://www.k-spec.ru/uslugi: title 24 знаков; H1: Услуги; описание 285 знаков",
        "https://www.k-spec.ru/kontakty: title 26 знаков; H1: Контакты; описание 197 знаков",
        "https://www.k-spec.ru/katalog/noski: title 20 знаков; H1: Носки; описания нет",
      ].join("\n"),
      evidenceUrl: home,
      evidenceQuote: null,
    },
    {
      id: "3",
      kind: "fact",
      title: "На изученных страницах есть цены",
      body: "https://www.k-spec.ru/uslugi: 2 500 000Р, 1 000 000Р",
      evidenceUrl: "https://www.k-spec.ru/uslugi",
      evidenceQuote: "2 500 000Р",
    },
    {
      id: "4",
      kind: "fact",
      title: "Способы связи на изученных страницах",
      body: [
        "https://www.k-spec.ru/uslugi: есть форма; телефон: +74951425175",
        "https://www.k-spec.ru/katalog/noski: телефон: +74951425175",
      ].join("\n"),
      evidenceUrl: home,
      evidenceQuote: null,
    },
  ];
  const rows = landingMap({ niche: "Производство спецодежды", regionName: "Подольск", findings });
  const socks = rows.find((row) => row.group === "Носки");
  assert.match(socks?.fact || "", /1 ссылка/);
  assert.match(socks?.fact || "", /Форма или телефон есть/);
  assert.match(socks?.action || "", /Вести на этот раздел/);

  const trousers = rows.find((row) => row.group === "Брюки");
  assert.match(trousers?.fact || "", /не открывали/);

  const services = rows.find((row) => row.url === "https://www.k-spec.ru/uslugi");
  assert.match(services?.action || "", /2 500 000Р/);

  assert.ok(rows.some((row) => row.group === "Общие запросы: Производство спецодежды"));
  assert.ok(!rows.some((row) => /kontakty/.test(row.url)));
  assert.doesNotMatch(JSON.stringify(rows), /показ(ов|ы) \d|ставк/);
});
