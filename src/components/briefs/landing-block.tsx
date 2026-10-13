import { LANDING_HEADERS, LANDING_LEAD, type LandingRow } from "@/lib/briefs/landing";

export default function LandingBlock({ rows }: { rows: LandingRow[] }) {
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 650 }}>Карта посадочных</h2>
      <p style={{ margin: 0, color: "var(--ink-muted)", lineHeight: 1.5 }}>{LANDING_LEAD}</p>
      {rows.length === 0 ? (
        <p style={{ margin: 0, color: "var(--ink-muted)" }}>Нет данных. Разделы появятся после повторного разбора.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="brief-table">
            <thead>
              <tr>
                {LANDING_HEADERS.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.url}>
                  <td>{row.group}</td>
                  <td>
                    {row.fact}
                    <span className="brief-table-meta">{row.url}</span>
                  </td>
                  <td>{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
