type Screen = { x: number; y: number; w: number; h: number; cols: number };

function SiteSketch({ x, y, w, h, cols }: Screen) {
  const pad = w * 0.08;
  const inner = w - pad * 2;
  const gap = inner * 0.05;
  const cardW = (inner - gap * (cols - 1)) / cols;
  const cardY = y + h * 0.58;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h * 0.09} fill="var(--bg-hover)" />
      <rect x={x + pad} y={y + h * 0.2} width={inner * 0.7} height={h * 0.065} rx={2} fill="var(--dg-ink)" opacity={0.75} />
      <rect x={x + pad} y={y + h * 0.3} width={inner * 0.45} height={h * 0.065} rx={2} fill="var(--dg-ink)" opacity={0.75} />
      <rect x={x + pad} y={y + h * 0.42} width={Math.max(inner * 0.3, 14)} height={h * 0.08} rx={3} fill="var(--dg-accent)" />
      {Array.from({ length: cols }, (_, i) => (
        <rect key={i} x={x + pad + i * (cardW + gap)} y={cardY} width={cardW} height={h * 0.3} rx={3} fill="var(--bg-hover)" />
      ))}
    </g>
  );
}

function Device({ frame, radius, screen }: { frame: { x: number; y: number; w: number; h: number }; radius: number; screen: Screen }) {
  return (
    <g>
      <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={radius} fill="var(--dg-panel-solid)" stroke="var(--dg-line)" strokeWidth={1.5} />
      <rect x={screen.x} y={screen.y} width={screen.w} height={screen.h} rx={Math.max(radius - 5, 2)} fill="var(--dg-bg)" />
      <SiteSketch {...screen} />
    </g>
  );
}

export default function PokazDevicesArt() {
  return (
    <figure className="w-full max-w-[340px]">
      <svg viewBox="0 0 320 200" className="w-full" role="img" aria-label="Один и тот же сайт на ноутбуке, планшете и телефоне">
        <Device frame={{ x: 16, y: 10, w: 220, h: 140 }} radius={8} screen={{ x: 24, y: 18, w: 204, h: 124, cols: 3 }} />
        <path d="M4 150 H248 L240 160 H12 Z" fill="var(--dg-panel-solid)" stroke="var(--dg-line)" strokeWidth={1.5} strokeLinejoin="round" />
        <Device frame={{ x: 190, y: 62, w: 90, h: 120 }} radius={10} screen={{ x: 197, y: 70, w: 76, h: 104, cols: 2 }} />
        <Device frame={{ x: 256, y: 96, w: 52, h: 98 }} radius={10} screen={{ x: 261, y: 105, w: 42, h: 80, cols: 1 }} />
      </svg>
      <figcaption className="mt-2 text-center text-xs" style={{ color: "var(--dg-muted)" }}>
        Один адрес — три экрана
      </figcaption>
    </figure>
  );
}
