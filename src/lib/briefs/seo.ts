import { slotFinding, type PresentFinding } from "@/lib/briefs/present";
import { resolveRegion } from "@/lib/briefs/wordstat";

export type SeoRow = {
  tone: "good" | "bad";
  observation: string;
  action: string;
};

export function seoOutline(input: {
  niche: string;
  regionName: string;
  findings: PresentFinding[];
}): SeoRow[] {
  const offer = slotFinding(input.findings, "offer");
  const body = offer?.body || "";
  const title = field(body, "Title:");
  const h1 = field(body, "Заголовок H1:");
  const description = field(body, "Описание:");
  const visible = [title, h1, description].filter(Boolean).join(" ");
  const rows: SeoRow[] = [];

  if (!title) {
    rows.push({
      tone: "bad",
      observation: "Title главной в разборе не найден.",
      action: "Поставить title с нишей и городом. Позицию в выдаче этот разбор не измеряет.",
    });
  } else {
    const missing = missingWords(visible, input.niche);
    const nicheNote = missing.length ? ` В title и H1 нет «${missing.join(", ")}».` : "";
    rows.push({
      tone: missing.length || title.length > 65 ? "bad" : "good",
      observation: `Title: «${title}». ${title.length} знаков.${nicheNote}`,
      action:
        title.length > 65
          ? "Сократить title до одной строки: ниша и город. Длинную строку поисковик может обрезать."
          : missing.length
            ? "Добавить недостающие слова ниши в title или H1."
            : "Длина title в пределах одной строки выдачи. Это не проверка позиции.",
    });
  }

  const pageHeads = input.findings.find((finding) => finding.title === "Заголовки изученных страниц");
  if (!pageHeads) {
    rows.push(
      h1
        ? {
            tone: "good",
            observation: `H1: «${h1}».`,
            action: "Один H1 на главной уже есть. Второй заголовок того же уровня не добавлять.",
          }
        : {
            tone: "bad",
            observation: "H1 главной не найден.",
            action: "Поставить один H1 с нишей. Сейчас страница опирается только на title, если он есть.",
          },
    );
  } else {
    const lines = pageHeads.body.split("\n").filter(Boolean);
    const missingH1 = lines.filter((line) => line.includes("H1 нет"));
    rows.push(
      missingH1.length
        ? {
            tone: "bad",
            observation: `Без H1: ${missingH1.length} из ${lines.length} изученных страниц.`,
            action: "Поставить один H1 на каждую такую страницу. Текст — ниша и город, без второго H1.",
          }
        : {
            tone: "good",
            observation: h1 ? `H1 главной: «${h1}». На изученных страницах H1 есть.` : "На изученных страницах H1 есть.",
            action: "Второй H1 на той же странице не добавлять.",
          },
    );
  }

  rows.push(
    description
      ? {
          tone: "good",
          observation: `Описание: «${clip(description, 140)}». ${description.length} знаков.`,
          action: "Описание есть. Это текст сниппета, не место в выдаче.",
        }
      : {
          tone: "bad",
          observation: "Мета-описание главной не найдено.",
          action: "Написать описание своими словами с нишей и городом. Сниппет поисковик может собрать и сам.",
        },
  );

  const region = resolveRegion(input.regionName);
  const city = region.exact && region.id !== "225" && region.id !== "1" ? region.label : "";
  if (city) {
    rows.push(
      missingWords(visible, city).length === 0
        ? {
            tone: "good",
            observation: `Город «${city}» есть в title, H1 или описании главной.`,
            action: "Отдельный локальный текст на других страницах этим разбором не проверялся.",
          }
        : {
            tone: "bad",
            observation: `Город «${city}» в title, H1 и описании главной не найден.`,
            action: "Добавить город в H1 или первый абзац. Частоту запроса с городом не считали.",
          },
    );
  }

  const prices = slotFinding(input.findings, "prices");
  rows.push(
    prices && /не найден/i.test(prices.title)
      ? {
          tone: "bad",
          observation: "На изученных страницах цены в тексте не найдены.",
          action: "Показать цену или порог заказа на странице услуги. Спрос по запросу «цена» не измеряли.",
        }
      : {
          tone: prices ? "good" : "bad",
          observation: prices ? "На изученных страницах цена в тексте есть." : "Цены: нет данных.",
          action: prices ? "Цену в тексте объявления можно взять со страницы, не придумывать." : "Сначала найти, есть ли цена на сайте.",
        },
  );

  const mobile = slotFinding(input.findings, "mobile");
  rows.push(
    mobile && /нет метки/i.test(mobile.title)
      ? {
          tone: "bad",
          observation: "На части страниц нет метки viewport.",
          action: "Добавить meta viewport. Удобство с телефона этим не проверено.",
        }
      : {
          tone: mobile ? "good" : "bad",
          observation: mobile ? "Метка viewport на изученных страницах есть." : "Метка viewport: нет данных.",
          action: "Наличие метки не значит, что сайт удобен с телефона.",
        },
  );

  const images = input.findings.find((finding) => finding.title.startsWith("Картинки") || finding.title.startsWith("У картинок"));
  if (images) {
    rows.push(
      /без подписи/.test(images.title)
        ? { tone: "bad", observation: images.title, action: "Заполнить alt словами с картинки и ниши, не списком ключей." }
        : { tone: "good", observation: images.title, action: "Подписи картинок трогать не нужно." },
    );
  }
  const indexing = input.findings.find((finding) => /noindex/i.test(finding.title));
  if (indexing) {
    rows.push(
      /стоит noindex/i.test(indexing.title)
        ? { tone: "bad", observation: indexing.title, action: "Убрать noindex со страниц, которые должны открываться из поиска." }
        : { tone: "good", observation: indexing.title, action: "Закрывать эти страницы от поиска не нужно." },
    );
  }

  return rows;
}

function field(body: string, label: string): string {
  const line = body.split("\n").find((row) => row.startsWith(label));
  return line ? line.slice(label.length).trim() : "";
}

function missingWords(hay: string, needle: string): string[] {
  const text = hay.toLowerCase().replace(/ё/g, "е");
  return needle
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^a-zа-я0-9]+/i)
    .filter((word) => word.length > 5 && !text.includes(word.slice(0, word.length - 2)));
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}
