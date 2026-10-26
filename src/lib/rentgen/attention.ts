import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { rentgenAttentionPath } from "@/lib/rentgen/shots";
import type { AttentionItem, RentgenAttention, RentgenView, ViewKind } from "@/lib/rentgen/types";

type Session = import("onnxruntime-node").InferenceSession;

/**
 * Прогноз внимания: MSI-Net, дообученная на UEyes (первый взгляд за 1 с), int8.
 * Веса: npm run rentgen:model. Лицензии: модель и веса MIT, датасет UEyes CC BY 4.0.
 */
const MODEL = join(process.cwd(), "models", "rentgen", "foveacast-v3-1s-int8.onnx");
const IN_H = 240;
const IN_W = 320;
/** Модель училась на кадрах, вписанных в 320×240 с серыми полями этого тона */
const PAD = 126;
const MAX_ITEMS = 8;
const MIN_SHARE = 0.005;
const MAP_W: Record<ViewKind, number> = { desktop: 720, mobile: 390 };
/** Палитра inferno: тёмное — мало внимания, светлое — много */
const INFERNO = [
  [0, 0, 4],
  [87, 16, 110],
  [188, 55, 84],
  [249, 142, 9],
  [252, 255, 164],
];

export type AttentionModel = { session: Session; release: () => Promise<void> };

/** null — весов нет на диске: слой просто не появится в отчёте */
export async function openAttention(): Promise<AttentionModel | null> {
  if (!existsSync(MODEL)) {
    console.error("[rentgen] attention: нет весов, запустите npm run rentgen:model");
    return null;
  }
  const ort = await import("onnxruntime-node");
  const session = await ort.InferenceSession.create(MODEL, { intraOpNumThreads: 2, interOpNumThreads: 1 });
  return { session, release: () => session.release() };
}

function colorize(gray: Buffer, pixels: number): Buffer {
  const rgba = Buffer.alloc(pixels * 4);
  const last = INFERNO.length - 1;
  for (let i = 0; i < pixels; i++) {
    const v = gray[i] / 255;
    const p = v * last;
    const k = Math.min(last - 1, Math.floor(p));
    const t = p - k;
    for (let c = 0; c < 3; c++) rgba[i * 4 + c] = Math.round(INFERNO[k][c] + (INFERNO[k + 1][c] - INFERNO[k][c]) * t);
    rgba[i * 4 + 3] = Math.round(Math.min(1, v * 1.6) * 190);
  }
  return rgba;
}

/** Сумма карты внутри прямоугольника с долями пикселей на краях */
function sumBox(map: Float32Array, mw: number, mh: number, x0: number, y0: number, x1: number, y1: number): number {
  let sum = 0;
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(mh, Math.ceil(y1)); y++) {
    const wy = Math.min(y1, y + 1) - Math.max(y0, y);
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(mw, Math.ceil(x1)); x++) {
      const wx = Math.min(x1, x + 1) - Math.max(x0, x);
      sum += map[y * mw + x] * wx * wy;
    }
  }
  return sum;
}

/** Первый экран вида → тепловая карта PNG и доли внимания кликабельных элементов */
export async function attendView(model: AttentionModel, scanId: string, kind: ViewKind, view: RentgenView, foldCss: number): Promise<RentgenAttention> {
  const fold = Math.min(foldCss, view.height);
  const meta = await sharp(view.shot).metadata();
  const scale = (meta.width ?? view.width) / view.width;
  const cropH = Math.min(meta.height ?? 0, Math.round(fold * scale));
  const { data, info } = await sharp(view.shot)
    .extract({ left: 0, top: 0, width: meta.width ?? view.width, height: cropH })
    .resize(IN_W, IN_H, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mw = info.width;
  const mh = info.height;
  const left = Math.floor((IN_W - mw) / 2);
  const top = Math.floor((IN_H - mh) / 2);

  const input = new Float32Array(3 * IN_H * IN_W).fill(PAD);
  const plane = IN_H * IN_W;
  for (let y = 0; y < mh; y++)
    for (let x = 0; x < mw; x++) {
      const i = (y * mw + x) * 3;
      const o = (top + y) * IN_W + left + x;
      input[o] = data[i];
      input[plane + o] = data[i + 1];
      input[2 * plane + o] = data[i + 2];
    }

  const { Tensor } = await import("onnxruntime-node");
  const { session } = model;
  const output = await session.run({ [session.inputNames[0]]: new Tensor("float32", input, [1, 3, IN_H, IN_W]) });
  const raw = output[session.outputNames[0]].data as Float32Array;

  const map = new Float32Array(mw * mh);
  let total = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let y = 0; y < mh; y++)
    for (let x = 0; x < mw; x++) {
      const v = Math.max(0, raw[(top + y) * IN_W + left + x]);
      map[y * mw + x] = v;
      total += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  total ||= 1;

  const sorted = Float32Array.from(map).sort().reverse();
  let hot = 0;
  for (let i = 0; i < Math.ceil(sorted.length / 10); i++) hot += sorted[i];

  const fx = mw / view.width;
  const fy = mh / fold;
  const items: AttentionItem[] = view.items
    .filter((item) => item.box.y < fold && item.box.w > 0 && item.box.h > 0)
    .map((item) => {
      const { x, y, w, h } = item.box;
      const bottom = Math.min(fold, y + h);
      const share = sumBox(map, mw, mh, x * fx, y * fy, (x + w) * fx, bottom * fy) / total;
      const area = (Math.min(w, view.width - x) * (bottom - y)) / (view.width * fold);
      return { label: item.label, share: Math.round(share * 1000) / 1000, lift: area > 0 ? Math.round((share / area) * 10) / 10 : 0, box: item.box };
    })
    .filter((item) => item.share >= MIN_SHARE)
    .sort((a, b) => b.share - a.share)
    .slice(0, MAX_ITEMS);

  const gray = Buffer.alloc(mw * mh);
  for (let i = 0; i < map.length; i++) gray[i] = Math.round(((map[i] - min) / (max - min || 1)) * 255);
  const outW = MAP_W[kind];
  const outH = Math.round((outW * fold) / view.width);
  const smooth = await sharp(gray, { raw: { width: mw, height: mh, channels: 1 } })
    .resize(outW, outH, { kernel: "cubic" })
    .blur(Math.max(1, outW / 160))
    .toColourspace("b-w")
    .raw()
    .toBuffer();
  const file = rentgenAttentionPath(scanId, kind);
  await sharp(colorize(smooth, outW * outH), { raw: { width: outW, height: outH, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(file);

  return { map: file, height: fold, focus: Math.round((hot / total) * 100) / 100, items };
}
