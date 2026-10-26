import demo from "@/lib/rentgen/demo.json";
import type { ClickKind, PxBox } from "@/lib/rentgen/types";

const COLOR: Record<ClickKind, string> = {
  ok: "var(--green)",
  dead: "var(--red)",
  fake: "var(--amber)",
  small: "var(--amber)",
  unknown: "var(--ink-muted)",
};

const pct = (value: number) => `${Math.round(value * 10000) / 100}%`;

/** Пример Рентгена для баннера на главной: снимок демо-страницы с рамками, без интерактива. */
export default function RentgenHubArt() {
  const items = demo.items as { n: number | null; kind: ClickKind; box: PxBox }[];
  return (
    <figure className="relative w-full max-w-[460px] overflow-hidden rounded-xl border" style={{ borderColor: "var(--dg-line)", lineHeight: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={demo.shot} alt="Снимок демо-страницы: красные и жёлтые рамки — кнопки и ссылки, которые не работают" width={demo.width} height={demo.height} loading="lazy" decoding="async" className="block h-auto w-full" />
      {items.map((item, index) => {
        const color = COLOR[item.kind];
        const problem = item.n !== null;
        return (
          <span
            key={index}
            aria-hidden
            className="absolute rounded-[3px]"
            style={{
              left: pct(item.box.x / demo.width),
              top: pct(item.box.y / demo.height),
              width: pct(item.box.w / demo.width),
              height: pct(item.box.h / demo.height),
              border: `${problem ? 2 : 1}px solid ${color}`,
              background: `color-mix(in oklab, ${color} ${problem ? 16 : 8}%, transparent)`,
            }}
          />
        );
      })}
    </figure>
  );
}
