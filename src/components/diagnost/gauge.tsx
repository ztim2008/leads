"use client";

import { useEffect, useState } from "react";
import { levelOf } from "@/lib/diagnost/levels";

const START = 150;
const SWEEP = 240;
const SEGMENTS: [number, number, string][] = [
  [0, 40, "var(--dg-critical)"],
  [40, 60, "var(--dg-poor)"],
  [60, 75, "var(--dg-fair)"],
  [75, 90, "var(--dg-good)"],
  [90, 100, "var(--dg-excellent)"],
];

const angle = (value: number) => START + (SWEEP * Math.max(0, Math.min(100, value))) / 100;
const point = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
};

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const [x1, y1] = point(cx, cy, r, from);
  const [x2, y2] = point(cx, cy, r, to);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

export default function Gauge({
  value,
  size = 320,
  animate = true,
  caption = "из 100",
  unit = "",
}: {
  value: number | null;
  size?: number;
  animate?: boolean;
  caption?: string;
  unit?: string;
}) {
  const target = value ?? 0;
  const [shown, setShown] = useState(animate ? 0 : target);
  const [needle, setNeedle] = useState(animate ? 0 : target);

  useEffect(() => {
    if (!animate) return;
    const raf = requestAnimationFrame(() => setNeedle(target));
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / 1600);
      const eased = 1 - Math.pow(1 - t, 4);
      setShown(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(frame);
    };
  }, [animate, target]);

  const cx = 160;
  const cy = 160;
  const r = 128;
  const level = value === null ? "none" : levelOf(target);

  return (
    <svg viewBox="0 0 320 250" width={size} height={(size * 250) / 320} role="img" aria-label={value === null ? "Нет данных" : `${target}${unit} ${caption}`} className={`dg-l-${level}`}>
      {SEGMENTS.map(([from, to, color]) => (
        <path key={from} d={arc(cx, cy, r, angle(from) + 0.8, angle(to) - 0.8)} stroke={color} strokeOpacity={0.18} strokeWidth={14} fill="none" strokeLinecap="butt" />
      ))}
      {value !== null &&
        SEGMENTS.filter(([from]) => from < shown).map(([from, to, color]) => (
          <path
            key={`on-${from}`}
            d={arc(cx, cy, r, angle(from) + 0.8, angle(Math.min(to, Math.max(shown, from + 0.5))) - (shown >= to ? 0.8 : 0))}
            stroke={color}
            strokeWidth={14}
            fill="none"
          />
        ))}
      {Array.from({ length: 21 }, (_, i) => i * 5).map((tick) => {
        const major = tick % 10 === 0;
        const [x1, y1] = point(cx, cy, r - 16, angle(tick));
        const [x2, y2] = point(cx, cy, r - (major ? 28 : 22), angle(tick));
        return <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--dg-muted)" strokeOpacity={major ? 0.7 : 0.35} strokeWidth={major ? 2 : 1} />;
      })}
      {[0, 50, 75, 100].map((tick) => {
        const [x, y] = point(cx, cy, r - 44, angle(tick));
        return (
          <text key={tick} x={x} y={y + 4} textAnchor="middle" fontSize="11" fill="var(--dg-muted)" className="dg-mono">
            {tick}
          </text>
        );
      })}
      {value !== null && (
        <g transform={`translate(${cx} ${cy})`}>
          <g className={animate ? "dg-needle" : undefined} style={{ transform: `rotate(${angle(needle)}deg)` }}>
            <line x1={-14} y1={0} x2={r - 30} y2={0} stroke="var(--dg-ink)" strokeWidth={3} strokeLinecap="round" />
          </g>
          <circle r={9} fill="var(--dg-panel-solid)" stroke="var(--dg-ink)" strokeWidth={3} />
        </g>
      )}
      <text x={cx} y={cy + 62} textAnchor="middle" fontSize="64" fontWeight="800" fill="var(--lvl)" style={{ fontFamily: "var(--font-montserrat)" }}>
        {value === null ? "—" : `${shown}${unit}`}
      </text>
      <text x={cx} y={cy + 84} textAnchor="middle" fontSize="12" fill="var(--dg-muted)" className="dg-mono">
        {value === null ? "недостаточно данных" : caption}
      </text>
    </svg>
  );
}
