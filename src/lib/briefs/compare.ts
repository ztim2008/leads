import { slotFinding, type PresentFinding } from "@/lib/briefs/present";
import { cityOf, factTitled, metrikaFinding, missingWords, sortChecks, type CheckRow } from "@/lib/briefs/seo";

export function directologistChecks(input: {
  niche: string;
  regionName: string;
  findings: PresentFinding[];
}): CheckRow[] {
  const rows: CheckRow[] = [];
  const opened = input.findings.find((finding) => finding.title.includes("Главная страница"));
  if (opened) {
    const down = opened.title.includes("не открылась");
    rows.push({
      tone: down ? "bad" : "good",
      when: "before",
      check: "Сайт открывается",
      fact: down ? opened.body : "Главная ответила на запрос.",
      action: down ? "Не запускать, пока страница не отвечает." : "Можно вести рекламу на сайт.",
      url: opened.evidenceUrl,
    });
  }

  const contact = slotFinding(input.findings, "contact");
  if (contact) {
    const found = contact.title.startsWith("Способы связи");
    const line = contact.body.split("\n")[0]?.replace(/^https?:\/\/\S+:\s*/, "") || contact.title;
    rows.push({
      tone: found ? "good" : "bad",
      when: "before",
      check: "Связь",
      fact: found ? clip(line, 160) : "Телефон, почта и форма не найдены.",
      action: found
        ? "В визитку объявления поставить тот же телефон, что на сайте."
        : "Добавить телефон или форму на страницу, куда ведёт объявление.",
      url: contact.evidenceUrl,
    });
  }

  const prices = slotFinding(input.findings, "prices");
  if (prices) {
    const missing = /не найден/i.test(prices.title);
    rows.push({
      tone: missing ? "bad" : "good",
      when: "before",
      check: "Цена для объявления",
      fact: missing ? "Цены текстом на изученных страницах нет." : clip(prices.body.replace(/^https?:\/\/\S+:\s*/, ""), 120),
      action: missing
        ? "Не писать сумму в объявлении. Или сначала показать цену на сайте."
        : "Брать цену в объявление дословно и вести на эту страницу.",
      url: prices.evidenceUrl,
    });
  }

  const offer = slotFinding(input.findings, "offer");
  const visible = (offer?.body || "")
    .split("\n")
    .filter((line) => /^(Title|Заголовок H1|Описание):/.test(line))
    .join(" ");
  if (offer) {
    const missing = missingWords(visible, input.niche);
    rows.push({
      tone: missing.length ? "bad" : "good",
      when: "later",
      check: "Ниша на посадочной",
      fact: missing.length
        ? `В title, H1 и описании главной нет «${missing.join(", ")}».`
        : `Слова ниши «${input.niche}» есть в title, H1 или описании.`,
      action: missing.length
        ? "Слово из запроса писать в объявлении, а программиста попросить добавить его на страницу."
        : "Заголовок объявления можно строить на тех же словах.",
      url: offer.evidenceUrl,
    });
  }

  const city = cityOf(input.regionName);
  if (city && offer) {
    const present = missingWords(visible, city).length === 0;
    rows.push({
      tone: present ? "good" : "bad",
      when: "later",
      check: "Город на посадочной",
      fact: present ? `«${city}» есть на главной.` : `«${city}» нет в title, H1 и описании главной.`,
      action: present
        ? "Город можно ставить в заголовок объявления."
        : "Регион задать в настройках кампании, а город в тексте объявления — только после правки страницы.",
      url: offer.evidenceUrl,
    });
  }

  const metrika = metrikaFinding(input.findings);
  if (metrika) {
    const found = !/не найден/.test(metrika.title);
    const id = /Номер счётчика: ([\d, ]+)/.exec(metrika.body)?.[1]?.trim();
    rows.push({
      tone: found ? "good" : "bad",
      when: "before",
      check: "Яндекс.Метрика",
      fact: found ? (id ? `Счётчик ${id} стоит на сайте.` : "Код Метрики на сайте есть.") : metrika.body,
      action: found
        ? "Получить доступ к счётчику, привязать его к кампании и проверить цели на форму и звонок."
        : /Tag Manager/.test(metrika.body)
          ? "Уточнить у владельца, стоит ли Метрика через Tag Manager, и получить доступ."
          : "Без счётчика не будет целей и стратегии с оплатой за конверсии. Попросить программиста поставить Метрику до запуска.",
      url: metrika.evidenceUrl,
    });
  }

  const services = factTitled(input.findings, /^Коллтрекинг/);
  if (services) {
    const tracking = /Коллтрекинг: /.test(services.body);
    rows.push({
      tone: tracking ? "good" : "bad",
      when: "later",
      check: "Звонки из рекламы",
      fact: services.body,
      action: tracking
        ? "Звонки разделятся по источнику: попросить доступ к коллтрекингу."
        : "Звонки из рекламы не разделятся по источнику. Для старта хватит цели на клик по телефону, коллтрекинг — потом.",
      url: services.evidenceUrl,
    });
  }

  return sortChecks(rows);
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}
