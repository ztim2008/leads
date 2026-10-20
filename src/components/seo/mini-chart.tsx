const SEO = [2, 3, 6, 11, 18, 27, 36, 45, 53, 60, 66, 71, 75];

const W = 300;
const H = 190;
const x = (m: number) => 12 + (m / 12) * (W - 24);
const y = (v: number) => 16 + (1 - v / 80) * (H - 44);

export default function SeoMiniChart() {
  const line = SEO.map((v, m) => `${m ? "L" : "M"}${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ads = `M${x(0)},${y(0)} L${x(1)},${y(46)} L${x(6)},${y(47)} L${x(6.1)},${y(0)} L${x(12)},${y(0)}`;

  return (
    <figure className="w-full max-w-[320px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="SEO растёт и остаётся, реклама пропадает после остановки бюджета">
        {[0, 40, 80].map((v) => (
          <line key={v} x1={12} x2={W - 12} y1={y(v)} y2={y(v)} stroke="var(--dg-line-soft)" />
        ))}
        <path d={`${line} L${x(12)},${y(0)} L${x(0)},${y(0)} Z`} fill="var(--green)" opacity="0.1" />
        <path d={ads} fill="none" stroke="var(--amber)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={line} fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(12)} cy={y(75)} r="5" fill="var(--green)" />
        <text x={x(0)} y={H - 8} fontSize="11" fill="var(--dg-muted)">старт</text>
        <text x={x(12)} y={H - 8} fontSize="11" fill="var(--dg-muted)" textAnchor="end">12 мес</text>
      </svg>
      <figcaption className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs" style={{ color: "var(--dg-muted)" }}>
        <span className="flex items-center gap-2">
          <span className="inline-block h-[3px] w-5 rounded" style={{ background: "var(--green)" }} />
          SEO
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-[3px] w-5 rounded" style={{ background: "var(--amber)" }} />
          Реклама
        </span>
      </figcaption>
    </figure>
  );
}
