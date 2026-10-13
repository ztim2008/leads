import { AD_LIMITS, type AdDraft } from "@/lib/briefs/ads";

export default function AdsBlock({ ads }: { ads: AdDraft[] }) {
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 650 }}>Объявления</h2>
      <p style={{ margin: 0, color: "var(--ink-muted)", lineHeight: 1.5 }}>
        Черновик для Директа. В кабинет не отправлен. Лимиты: заголовок {AD_LIMITS.title}, дополнительный{" "}
        {AD_LIMITS.title2}, текст {AD_LIMITS.text}.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="brief-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Заголовок</th>
              <th>Дополнительный</th>
              <th>Текст</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((ad, index) => (
              <tr key={ad.title + ad.text}>
                <td>{index + 1}</td>
                <td>
                  {ad.title}
                  <span className="brief-table-meta">
                    {ad.title.length} / {AD_LIMITS.title}
                  </span>
                </td>
                <td>
                  {ad.title2}
                  <span className="brief-table-meta">
                    {ad.title2.length} / {AD_LIMITS.title2}
                  </span>
                </td>
                <td>
                  {ad.text}
                  <span className="brief-table-meta">
                    {ad.text.length} / {AD_LIMITS.text}. {ad.basis}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
