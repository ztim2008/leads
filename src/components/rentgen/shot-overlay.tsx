import type { CSSProperties } from "react";
import { GROUP_OF, type Group } from "@/lib/rentgen/groups";
import type { ClickKind, PxBox } from "@/lib/rentgen/types";

/** attn — нейтральные рамки слоя «Внимание»: цвет там несёт тепловая карта */
export type OverlayGroup = Group | "attn";

export type OverlayItem = { n: number | null; kind: ClickKind; group?: OverlayGroup; label: string; reason: string; box: PxBox };

type Props = {
  shot: string;
  width: number;
  /** Видимая высота: весь снимок или первый экран, если есть heat */
  height: number;
  items: OverlayItem[];
  film?: boolean;
  /** Тепловая карта поверх первого экрана; снимок обрезается до height */
  heat?: string;
  activeN?: number | null;
  idPrefix?: string;
  onPick?: (n: number) => void;
  alt: string;
  eager?: boolean;
};

/** Метка над рамкой у самого верха снимка обрежется краем панели — у таких рамок она ставится снизу */
const EDGE_PX = 40;

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
export default function ShotOverlay({ shot, width, height, items, film = false, heat, activeN = null, idPrefix = "rg-f", onPick, alt, eager = false }: Props) {
  return (
    <div className="rg-shot" data-film={film} data-heat={heat ? true : undefined} style={heat ? { aspectRatio: `${width} / ${height}` } : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shot} alt={alt} width={width} height={heat ? undefined : height} loading={eager ? "eager" : "lazy"} decoding="async" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {heat && <img src={heat} alt="" className="rg-heat" aria-hidden="true" />}
      {items.map((item, index) => {
        const group = item.group ?? GROUP_OF[item.kind];
        const common = {
          className: `rg-frame rg-g-${group}`,
          "data-kind": item.kind,
          "data-problem": item.n !== null,
          "data-active": item.n !== null && item.n === activeN,
          "data-edge": item.box.y < EDGE_PX ? true : undefined,
          style: frameStyle(item.box, width, height, shot),
          title: `${item.label || "Без подписи"} — ${item.reason}`,
        };
        if (item.n !== null && onPick) {
          const n = item.n;
          return (
            <button key={index} type="button" id={`${idPrefix}-${n}`} aria-label={`${group === "attn" ? "Элемент" : "Проблема"} ${n}: ${item.reason}`} onClick={() => onPick(n)} {...common}>
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
