const SEO = [2, 3, 5, 9, 15, 23, 32, 41, 50, 57, 63, 68, 72];
const ADS = [0, 46, 48, 47, 49, 48, 47, 0, 0, 0, 0, 0, 0];

const W = 720;
const H = 300;
const PAD = { l: 40, r: 16, t: 20, b: 36 };
const MAX = 80;

const x = (m: number) => PAD.l + (m / 12) * (W - PAD.l - PAD.r);
const y = (v: number) => PAD.t + (1 - v / MAX) * (H - PAD.t - PAD.b);

function path(values: number[]) {
  return values.map((v, m) => `${m === 0 ? "M" : "L"}${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
}

function adsPath() {
  return [
    `M${x(0)},${y(0)}`,
    `L${x(1)},${y(ADS[1])}`,
    ...ADS.slice(2, 7).map((v, i) => `L${x(i + 2)},${y(v)}`),
    `L${x(6.15)},${y(0)}`,
    `L${x(12)},${y(0)}`,
  ].join(" ");
}

export default function GrowthChart() {
  const area = `${path(SEO)} L${x(12)},${y(0)} L${x(0)},${y(0)} Z`;

  return (
    <figure className="seo-panel p-5 md:p-7">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="flex items-center gap-2">
          <span className="inline-block h-[3px] w-6 rounded" style={{ background: "var(--seo-accent)" }} />
          SEO: переходы растут и остаются
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-[3px] w-6 rounded" style={{ background: "var(--seo-ads)" }} />
          Реклама: поток есть, пока платите
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label="График: переходы из SEO растут постепенно и сохраняются, переходы из рекламы появляются сразу и пропадают после остановки бюджета">
        {[0, 20, 40, 60, 80].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--seo-line-soft)" />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--seo-muted)" className="seo-mono">
              {v}
            </text>
          </g>
        ))}
        {[0, 3, 6, 9, 12].map((m) => (
          <text key={m} x={x(m)} y={H - 12} textAnchor={m === 0 ? "start" : m === 12 ? "end" : "middle"} fontSize="11" fill="var(--seo-muted)" className="seo-mono">
            {m === 0 ? "старт" : `${m} мес`}
          </text>
        ))}

        <rect x={x(0)} y={PAD.t} width={x(2) - x(0)} height={H - PAD.t - PAD.b} fill="var(--seo-layer)" opacity="0.7" />
        <text x={(x(0) + x(2)) / 2} y={PAD.t + 16} textAnchor="middle" fontSize="11" fill="var(--seo-muted)">
          подготовка
        </text>

        <path d={area} fill="var(--seo-accent)" opacity="0.1" />
        <path d={adsPath()} fill="none" stroke="var(--seo-ads)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={path(SEO)} fill="none" stroke="var(--seo-accent)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />

        <line x1={x(6.15)} x2={x(6.15)} y1={y(48)} y2={y(62)} stroke="var(--seo-ads)" strokeDasharray="3 3" />
        <text x={x(6.15) + 6} y={y(60)} fontSize="12" fill="var(--seo-ads)">
          бюджет закончился
        </text>
        <circle cx={x(12)} cy={y(SEO[12])} r="5" fill="var(--seo-accent)" />
      </svg>

      <figcaption className="mt-3 text-sm seo-muted">
        Условный пример для понимания. Ось слева — переходы в день. Реальные цифры зависят от ниши, города, конкурентов и состояния сайта.
      </figcaption>
    </figure>
  );
}
