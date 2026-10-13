import { ACTION_HEADER, CHECK_HEADER, FACT_HEADER, checkMark, checkVerdict, type CheckRow } from "@/lib/briefs/seo";

export default function CompareBlock({ title, lead, rows }: { title: string; lead: string; rows: CheckRow[] }) {
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 650 }}>{title}</h2>
      <p style={{ margin: 0, color: "var(--ink-muted)", lineHeight: 1.5 }}>{lead}</p>
      {rows.length === 0 ? (
        <p style={{ margin: 0, color: "var(--ink-muted)" }}>Нет данных.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="brief-table">
            <thead>
              <tr>
                <th>{CHECK_HEADER}</th>
                <th>{FACT_HEADER}</th>
                <th>{ACTION_HEADER}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.check}>
                  <td>
                    <strong className="brief-verdict" data-mark={checkMark(row)}>
                      {checkVerdict(row)}
                    </strong>
                    <span className="brief-table-meta">{row.check}</span>
                  </td>
                  <td>
                    {row.fact}
                    {row.url && <span className="brief-table-meta">{row.url}</span>}
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
