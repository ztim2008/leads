import type { CSSProperties } from "react";
import { GROUP_OF } from "@/lib/rentgen/groups";
import type { ClickKind, PxBox } from "@/lib/rentgen/types";

export type OverlayItem = { n: number | null; kind: ClickKind; label: string; reason: string; box: PxBox };

type Props = {
  shot: string;
  width: number;
  height: number;
  items: OverlayItem[];
  film?: boolean;
  activeN?: number | null;
  idPrefix?: string;
  onPick?: (n: number) => void;
  alt: string;
  eager?: boolean;
};

const pct = (value: number) => `${Math.round(value * 10000) / 100}%`;

function frameStyle(box: PxBox, width: number, height: number, shot: string): CSSProperties {
  const x = Math.max(0, Math.min(box.x, width - 1));
  const y = Math.max(0, Math.min(box.y, height - 1));
  const w = Math.max(1, Math.min(box.w, width - x));
  const h = Math.max(1, Math.min(box.h, height - y));
  return {
    left: pct(x / width),
    top: pct(y / height),
    width: pct(w / width),
    height: pct(h / height),
    ["--src" as string]: `url(${shot})`,
    ["--bs" as string]: `${pct(width / w)} ${pct(height / h)}`,
    ["--bp" as string]: `${w >= width ? "0%" : pct(x / (width - w))} ${h >= height ? "0%" : pct(y / (height - h))}`,
  };
}

/** Снимок страницы с рамками; координаты в px документа пересчитываются в проценты — масштаб любой. */
export default function ShotOverlay({ shot, width, height, items, film = false, activeN = null, idPrefix = "rg-f", onPick, alt, eager = false }: Props) {
  return (
    <div className="rg-shot" data-film={film}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shot} alt={alt} width={width} height={height} loading={eager ? "eager" : "lazy"} decoding="async" />
      {items.map((item, index) => {
        const group = GROUP_OF[item.kind];
        const common = {
          className: `rg-frame rg-g-${group}`,
          "data-kind": item.kind,
          "data-problem": item.n !== null,
          "data-active": item.n !== null && item.n === activeN,
          style: frameStyle(item.box, width, height, shot),
          title: `${item.label || "Без подписи"} — ${item.reason}`,
        };
        if (item.n !== null && onPick) {
          const n = item.n;
          return (
            <button key={index} type="button" id={`${idPrefix}-${n}`} aria-label={`Проблема ${n}: ${item.reason}`} onClick={() => onPick(n)} {...common}>
              <span className="rg-tag">{n}</span>
            </button>
          );
        }
        return (
          <span key={index} {...common}>
            {item.n !== null && <span className="rg-tag">{item.n}</span>}
          </span>
        );
      })}
    </div>
  );
}
