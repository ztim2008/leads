export default function CompareBlock({
  title,
  lead,
  good,
  bad,
}: {
  title: string;
  lead: string;
  good: string[];
  bad: string[];
}) {
  const count = Math.max(good.length, bad.length, 1);
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 650 }}>{title}</h2>
      <p style={{ margin: 0, color: "var(--ink-muted)", lineHeight: 1.5 }}>{lead}</p>
      <div style={{ overflowX: "auto" }}>
        <table className="brief-table">
          <thead>
            <tr>
              <th>Хорошо</th>
              <th>Плохо</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: count }, (_, index) => (
              <tr key={index}>
                <td>{good[index] || ""}</td>
                <td>{bad[index] || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
