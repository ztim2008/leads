import type { StrategyOutline } from "@/lib/briefs/strategy";

export default function StrategyBlock({ outline }: { outline: StrategyOutline }) {
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 650 }}>Стратегия</h2>
      <p style={{ margin: 0, color: "var(--ink-muted)", lineHeight: 1.5 }}>
        Только по аудиту сайта. Бюджет, ставки и прогноз заявок сюда не входят.
      </p>
      {outline.gaps.map((gap) => (
        <div key={gap} className="brief-item">
          <p style={{ margin: 0 }}>{gap}</p>
        </div>
      ))}
      <h2 style={{ margin: "12px 0 0", fontSize: "var(--text-lg)", fontWeight: 650 }}>До запуска</h2>
      <p style={{ margin: 0, lineHeight: 1.5 }}>
        {outline.actions.length
          ? "Это пункты из блока «Рекомендации». Черновик новых действий не добавляет."
          : "Пока нет."}
      </p>
      <h2 style={{ margin: "12px 0 0", fontSize: "var(--text-lg)", fontWeight: 650 }}>Коммерческое предложение</h2>
      {outline.proposal.map((row) => (
        <div key={row.label} className="brief-item" style={{ display: "grid", gap: 4 }}>
          <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>{row.label}</p>
          <p style={{ margin: 0 }}>{row.value}</p>
        </div>
      ))}
    </section>
  );
}
