import { GROUP_LABELS, type FindingKind } from "@/lib/briefs/sections";

export type PresentFinding = {
  id: string;
  kind: string;
  title: string;
  body: string;
  evidenceUrl: string | null;
  evidenceQuote: string | null;
};

export const SLOT_ORDER = ["offer", "prices", "contact", "mobile"] as const;
export type SlotId = (typeof SLOT_ORDER)[number];

export const SLOT_LABELS: Record<SlotId, string> = {
  offer: "Предложение",
  prices: "Цены",
  contact: "Связь",
  mobile: "С телефона",
};

export const WORDSTAT_PAUSE =
  "Показы Wordstat отложены, пока не оплачен счёт Yandex Cloud.";

export function slotOf(title: string): SlotId | null {
  const value = title.toLowerCase();
  if (value.startsWith("как страница называет")) return "offer";
  if (value.includes("цен")) return "prices";
  if (value.startsWith("способы связи") || value.startsWith("форма и телефон")) return "contact";
  if (value.includes("viewport")) return "mobile";
  return null;
}

export function companyName(findings: PresentFinding[], host: string): string {
  const offer = findings.find((finding) => slotOf(finding.title) === "offer");
  const source = offer?.evidenceQuote || offer?.title || "";
  const head = source.split("|")[0]?.trim();
  if (head && head.length > 1 && head.length < 80) return head;
  return host;
}

export function slotSummary(finding: PresentFinding, slot: SlotId): string {
  if (slot === "prices" || slot === "mobile") return finding.title;
  if (slot === "contact") {
    const line = finding.body.split("\n")[0] || finding.title;
    return clipText(line.replace(/^https?:\/\/\S+:\s*/, ""), 160);
  }
  return clipText(finding.body.replace(/^Title:\s*/i, ""), 160);
}

export function clipText(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}

export function findingsByKind(findings: PresentFinding[]): Record<FindingKind, PresentFinding[]> {
  return {
    fact: findings.filter((finding) => finding.kind === "fact"),
    hypothesis: findings.filter((finding) => finding.kind === "hypothesis"),
    recommendation: findings.filter((finding) => finding.kind === "recommendation"),
  };
}

export function slotFinding(findings: PresentFinding[], slot: SlotId): PresentFinding | undefined {
  return findings.find((finding) => slotOf(finding.title) === slot);
}

export function telegramBrief(input: {
  company: string;
  siteUrl: string;
  niche: string;
  regionName: string;
  goal: string;
  findings: PresentFinding[];
  semantics?: PresentFinding[];
  seo?: string[];
}): string {
  const lines = [
    input.company,
    input.siteUrl,
    `${input.niche} · ${input.regionName}`,
    input.goal,
    "",
  ];
  const counted = (input.semantics || []).filter((row) => /^\d+$/.test(row.evidenceQuote || ""));
  if (counted.length) {
    lines.push("Семантика · показы за 30 дней, Wordstat");
    for (const row of counted.slice(0, 12)) {
      lines.push(`• ${row.title} — ${new Intl.NumberFormat("ru-RU").format(Number(row.evidenceQuote))}`);
    }
    lines.push("");
  }
  const groups = findingsByKind(input.findings);
  for (const kind of ["fact", "hypothesis", "recommendation"] as const) {
    const rows = groups[kind];
    if (!rows.length) continue;
    lines.push(GROUP_LABELS[kind]);
    for (const row of rows) {
      lines.push(`• ${row.title}`);
      const detail = clipText(row.body, 180);
      if (detail && detail !== row.title) lines.push(detail);
      if (row.evidenceUrl) lines.push(row.evidenceUrl);
    }
    lines.push("");
  }
  if (input.seo?.length) {
    lines.push("Что исправить");
    for (const line of input.seo) lines.push(`• ${clipText(line, 160)}`);
    lines.push("");
  }
  lines.push("Коммерческое предложение");
  lines.push(
    counted.length
      ? "Цена и срок заполняет человек. Конкуренты: нет данных."
      : "Цена и срок заполняет человек. Показы и конкуренты: нет данных.",
  );
  return lines.join("\n").trim();
}
