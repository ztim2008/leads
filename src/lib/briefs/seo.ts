import { slotFinding, type PresentFinding } from "@/lib/briefs/present";
import { resolveRegion } from "@/lib/briefs/wordstat";

/** before — решить до запуска Директа, later — можно после. */
export type CheckWhen = "before" | "later";

export type CheckRow = {
  tone: "good" | "bad";
  when: CheckWhen;
  check: string;
  fact: string;
  action: string;
  url: string | null;
};

export const CHECK_HEADER = "Проверка";
export const FACT_HEADER = "На сайте сейчас · факт";
export const ACTION_HEADER = "Что сделать · рекомендация";

export const DIRECTOLOGIST_LEAD =
  "Что брать в объявление и что решить до запуска. Факт — со страницы, совет — наш.";
export const DEVELOPER_LEAD =
  "Что в HTML изученных страниц исправить. Позиции и трафик не измерялись.";

export function checkVerdict(row: CheckRow): string {
  if (row.tone === "good") return "Хорошо";
  return row.when === "before" ? "Плохо · до запуска" : "Плохо · можно позже";
}

export function sortChecks(rows: CheckRow[]): CheckRow[] {
  const rank = (row: CheckRow) => (row.tone === "good" ? 2 : row.when === "before" ? 0 : 1);
  return [...rows].sort((a, b) => rank(a) - rank(b));
}

export function seoOutline(input: {
  niche: string;
  regionName: string;
  findings: PresentFinding[];
}): CheckRow[] {
  const offer = slotFinding(input.findings, "offer");
  const body = offer?.body || "";
  const home = offer?.evidenceUrl || null;
  const title = field(body, "Title:");
  const h1 = field(body, "Заголовок H1:");
  const description = field(body, "Описание:");
  const visible = [title, h1, description].filter(Boolean).join(" ");
  const rows: CheckRow[] = [];

  if (!title) {
    rows.push({
      tone: "bad",
      when: "later",
      check: "Title главной",
      fact: "Title в разборе не найден.",
      action: "Поставить title: ниша и город в одной строке.",
      url: home,
    });
  } else {
    const missing = missingWords(visible, input.niche);
    const long = title.length > 65;
    const nicheNote = missing.length ? ` В title, H1 и описании нет «${missing.join(", ")}».` : "";
    rows.push({
      tone: missing.length || long ? "bad" : "good",
      when: "later",
      check: "Title главной",
      fact: `«${clip(title, 120)}», ${title.length} знаков.${nicheNote}`,
      action: long
        ? "Сократить до 65 знаков: ниша и город впереди, название компании в конце."
        : missing.length
          ? `Добавить «${missing.join(", ")}» в title или H1.`
          : "Не трогать.",
      url: home,
    });
  }

  const heads = pageLines(input.findings);
  if (!heads.length) {
    rows.push(
      h1
        ? { tone: "good", when: "later", check: "H1", fact: `H1 главной: «${h1}».`, action: "Второй H1 не добавлять.", url: home }
        : {
            tone: "bad",
            when: "later",
            check: "H1",
            fact: "H1 главной не найден.",
            action: "Поставить один H1 с нишей и городом.",
            url: home,
          },
    );
  } else {
    const noH1 = heads.filter((line) => line.text.includes("H1 нет"));
    rows.push(
      noH1.length
        ? {
            tone: "bad",
            when: "later",
            check: "H1",
            fact: `H1 нет на ${noH1.length} из ${heads.length} страниц: ${noH1.map((line) => line.url).join(", ")}.`,
            action: "Поставить один H1 на каждую: что продаём и где. На главной — ниша и город.",
            url: null,
          }
        : { tone: "good", when: "later", check: "H1", fact: `H1 есть на всех ${heads.length} изученных страницах.`, action: "Второй H1 не добавлять.", url: home },
    );
    const multi = heads.filter((line) => /\(\d+ H1\)/.test(line.text));
    if (multi.length) {
      rows.push({
        tone: "bad",
        when: "later",
        check: "Несколько H1",
        fact: `Больше одного H1: ${multi.map((line) => line.url).join(", ")}.`,
        action: "Оставить один H1, остальные сделать H2.",
        url: null,
      });
    }
    const noDescription = heads.filter((line) => line.text.includes("описания нет"));
    const longDescription = heads.filter((line) => descriptionLength(line.text) > 160);
    const problems = [
      noDescription.length ? `Описания нет на ${noDescription.map((line) => line.url).join(", ")}.` : "",
      longDescription.length ? `Описание длиннее 160 знаков: ${longDescription.map((line) => line.url).join(", ")}.` : "",
    ].filter(Boolean);
    rows.push(
      problems.length
        ? {
            tone: "bad",
            when: "later",
            check: "Мета-описание",
            fact: problems.join(" "),
            action: "Описание 70–160 знаков на каждой странице: что продаём, где, чем отличаемся.",
            url: null,
          }
        : {
            tone: "good",
            when: "later",
            check: "Мета-описание",
            fact: "Описание есть на изученных страницах, не длиннее 160 знаков.",
            action: "Не трогать. Это текст сниппета, не место в выдаче.",
            url: home,
          },
    );
  }

  if (!heads.length) {
    rows.push(
      description
        ? {
            tone: "good",
            when: "later",
            check: "Мета-описание",
            fact: `«${clip(description, 140)}», ${description.length} знаков.`,
            action: "Не трогать. Это текст сниппета, не место в выдаче.",
            url: home,
          }
        : {
            tone: "bad",
            when: "later",
            check: "Мета-описание",
            fact: "Описание главной не найдено.",
            action: "Написать 70–160 знаков с нишей и городом.",
            url: home,
          },
    );
  }

  const city = cityOf(input.regionName);
  if (city) {
    const present = missingWords(visible, city).length === 0;
    rows.push({
      tone: present ? "good" : "bad",
      when: "later",
      check: "Город",
      fact: present ? `«${city}» есть в title, H1 или описании главной.` : `«${city}» нет в title, H1 и описании главной.`,
      action: present ? "Не трогать." : `Добавить «${city}» в H1 или первый абзац главной.`,
      url: home,
    });
  }

  const prices = slotFinding(input.findings, "prices");
  const priceMissing = !prices || /не найден/i.test(prices.title);
  rows.push({
    tone: priceMissing ? "bad" : "good",
    when: "later",
    check: "Цена текстом",
    fact: priceMissing ? "Цены текстом на изученных страницах нет." : clip(prices.body.replace(/^https?:\/\/\S+:\s*/, ""), 120),
    action: priceMissing ? "Показать цену или порог заказа текстом на странице услуги, не картинкой." : "Оставить текстом, не переносить в картинку.",
    url: prices?.evidenceUrl || home,
  });

  const mobile = slotFinding(input.findings, "mobile");
  const noViewport = !mobile || /нет метки/i.test(mobile.title);
  rows.push({
    tone: noViewport ? "bad" : "good",
    when: noViewport ? "before" : "later",
    check: "Метка viewport",
    fact: noViewport ? "На части страниц нет meta viewport." : "Meta viewport есть на изученных страницах.",
    action: noViewport
      ? "Добавить meta viewport: большая часть рекламы идёт с телефона."
      : "Метка — не проверка удобства. Открыть форму с телефона вручную.",
    url: mobile?.evidenceUrl || home,
  });

  const images = input.findings.find((finding) => finding.title.startsWith("Картинки") || finding.title.startsWith("У картинок"));
  if (images) {
    const bare = /без подписи/.test(images.title);
    rows.push({
      tone: bare ? "bad" : "good",
      when: "later",
      check: "Alt у картинок",
      fact: images.title.replace(/^Картинки без подписи alt: /, "Без alt: ") + ".",
      action: bare ? "Подписать картинки каталога и работ названием товара, не списком ключей." : "Не трогать.",
      url: images.evidenceUrl,
    });
  }

  const indexing = input.findings.find((finding) => /noindex/i.test(finding.title));
  if (indexing) {
    const hidden = /стоит noindex/i.test(indexing.title);
    rows.push({
      tone: hidden ? "bad" : "good",
      when: "later",
      check: "Закрытие от поиска",
      fact: hidden ? indexing.body : "Метки noindex на изученных страницах нет.",
      action: hidden ? "Снять noindex со страниц, которые должны находиться в поиске." : "Не трогать.",
      url: indexing.evidenceUrl,
    });
  }

  const metrika = metrikaFinding(input.findings);
  if (metrika) {
    const found = metrika.title.endsWith("найден") && !/не найден/.test(metrika.title);
    const partial = found && /Нет на /.test(metrika.body);
    rows.push({
      tone: found && !partial ? "good" : "bad",
      when: found && !partial ? "later" : "before",
      check: "Яндекс.Метрика",
      fact: metrika.body,
      action: !found
        ? "Поставить счётчик на все страницы и цели: отправка формы, клик по телефону и почте."
        : partial
          ? "Поставить тот же счётчик на страницы, где его нет."
          : "Проверить в Метрике цели: отправка формы, клик по телефону.",
      url: metrika.evidenceUrl,
    });
  }

  const robots = factTitled(input.findings, /^robots\.txt/);
  if (robots) {
    const missing = /не найден/.test(robots.title);
    const closed = /закрывает/.test(robots.title);
    const noSitemapLine = !missing && !closed && /Строки Sitemap в файле нет/.test(robots.body);
    rows.push({
      tone: missing || closed || noSitemapLine ? "bad" : "good",
      when: "later",
      check: "robots.txt",
      fact: closed ? robots.body : `${robots.title}. ${robots.body}`,
      action: missing
        ? "Положить robots.txt в корень сайта со строкой Sitemap."
        : closed
          ? "Снять Disallow: / для Яндекса, если сайт должен находиться в поиске."
          : noSitemapLine
            ? "Добавить строку Sitemap: с адресом карты сайта."
            : "Не трогать.",
      url: robots.evidenceUrl,
    });
  }

  const sitemap = factTitled(input.findings, /^sitemap\.xml/);
  if (sitemap) {
    const missing = /не найден/.test(sitemap.title);
    const foreign = /чужой домен/.test(sitemap.title);
    rows.push({
      tone: missing || foreign ? "bad" : "good",
      when: "later",
      check: "sitemap.xml",
      fact: foreign ? `Карта ведёт на чужой домен. ${sitemap.body}` : sitemap.title,
      action: missing
        ? "Сделать sitemap.xml со страницами услуг и каталога."
        : foreign
          ? "Пересобрать карту сайта: в ней должны быть адреса этого домена, а не чужого."
          : "Не трогать.",
      url: sitemap.evidenceUrl,
    });
  }

  const canonical = factTitled(input.findings, /^Canonical/);
  if (canonical) {
    const elsewhere = /другой адрес/.test(canonical.title);
    const partial = /не на всех/.test(canonical.title);
    rows.push({
      tone: elsewhere || partial ? "bad" : "good",
      when: "later",
      check: "Canonical",
      fact: elsewhere || partial ? canonical.body.replace(/\n/g, "; ") : canonical.title + ".",
      action: elsewhere
        ? "Проверить: canonical должен вести на эту же страницу, если она не копия другой."
        : partial
          ? "Поставить canonical на каждую страницу, на её собственный адрес."
          : "Не трогать.",
      url: null,
    });
  }

  const dupes = factTitled(input.findings, /title на нескольких|Title изученных страниц разные/);
  if (dupes) {
    const bad = /на нескольких/.test(dupes.title);
    rows.push({
      tone: bad ? "bad" : "good",
      when: "later",
      check: "Повтор title",
      fact: bad ? dupes.body.replace(/\n/g, "; ") : dupes.body,
      action: bad ? "Дать каждой странице свой title под её товар или услугу." : "Не трогать.",
      url: null,
    });
  }

  return sortChecks(rows);
}

export function factTitled(findings: PresentFinding[], re: RegExp): PresentFinding | undefined {
  return findings.find((finding) => finding.kind === "fact" && re.test(finding.title));
}

export function metrikaFinding(findings: PresentFinding[]): PresentFinding | undefined {
  return factTitled(findings, /^Счётчик Яндекс\.Метрики/);
}

export function cityOf(regionName: string): string {
  const region = resolveRegion(regionName);
  return region.exact && region.id !== "225" && region.id !== "1" ? region.label : "";
}

export function missingWords(hay: string, needle: string): string[] {
  const text = hay.toLowerCase().replace(/ё/g, "е");
  return needle
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^a-zа-я0-9]+/i)
    .filter((word) => word.length > 5 && !text.includes(word.slice(0, word.length - 2)));
}

function pageLines(findings: PresentFinding[]): { url: string; text: string }[] {
  const heads = findings.find((finding) => finding.title === "Заголовки изученных страниц");
  if (!heads) return [];
  return heads.body
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const cut = line.indexOf(": title");
      return cut > 0 ? { url: line.slice(0, cut), text: line.slice(cut + 2) } : { url: "", text: line };
    });
}

function descriptionLength(text: string): number {
  const match = text.match(/описание (\d+) знак/);
  return match ? Number(match[1]) : 0;
}

function field(body: string, label: string): string {
  const line = body.split("\n").find((row) => row.startsWith(label));
  return line ? line.slice(label.length).trim() : "";
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}
