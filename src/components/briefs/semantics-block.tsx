import { intentOf, resolveRegion, type WordstatPhrase } from "@/lib/briefs/wordstat";
import { WORDSTAT_PAUSE, type PresentFinding } from "@/lib/briefs/present";

const ORDER: WordstatPhrase["intent"][] = ["order", "price", "geo", "info", "other"];
const LABELS: Record<WordstatPhrase["intent"], string> = {
  order: "Заказ",
  price: "Цена",
  geo: "Регион",
  info: "Информация",
  other: "Другие запросы",
};

export default function SemanticsBlock({
  findings,
  regionName,
  enabled,
}: {
  findings: PresentFinding[];
  regionName: string;
  enabled: boolean;
}) {
  const region = resolveRegion(regionName);
  const error = findings.find((finding) => !/^\d+$/.test(finding.evidenceQuote || ""));
  const rows = findings.filter((finding) => /^\d+$/.test(finding.evidenceQuote || ""));
  const grouped = ORDER.map((intent) => ({
    intent,
    label: LABELS[intent],
    rows: rows.filter((finding) => intentOf(finding.title, region.label) === intent),
  })).filter((group) => group.rows.length > 0);

  return (
    <section style={{ display: "grid", gap: 8 }}>
      <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 650 }}>Семантика</h2>
      {rows.length === 0 && !error && (
        <p style={{ margin: 0, color: "var(--ink-muted)" }}>
          {enabled ? "В этом прогоне запросов нет. Повторите разбор." : WORDSTAT_PAUSE}
        </p>
      )}
      {error && <p style={{ margin: 0 }}>{error.body}</p>}
      {grouped.map((group) => (
        <div key={group.intent}>
          <h3 style={{ margin: "8px 0", fontSize: "var(--text-base)", fontWeight: 650 }}>{group.label}</h3>
          {group.rows.map((row) => (
            <div key={row.id} className="brief-item" style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <span>{row.title}</span>
              <span style={{ color: "var(--ink-muted)", whiteSpace: "nowrap" }}>
                {new Intl.NumberFormat("ru-RU").format(Number(row.evidenceQuote))}
              </span>
            </div>
          ))}
        </div>
      ))}
      {rows.length > 0 && (
        <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>
          Показы за 30 дней, Wordstat, {region.exact ? region.label : "Россия, город в справочнике не найден"}.
        </p>
      )}
    </section>
  );
}
