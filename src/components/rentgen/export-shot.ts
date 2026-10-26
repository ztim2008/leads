import { GROUP_OF } from "@/lib/rentgen/groups";
import type { OverlayGroup, OverlayItem } from "@/components/rentgen/shot-overlay";

type ExportInput = {
  root: HTMLElement;
  shot: string;
  width: number;
  /** Высота кадра; с heat — первый экран, снимок обрезается */
  height: number;
  heat?: string;
  items: OverlayItem[];
  legend: { label: string; group: OverlayGroup; count?: number }[];
  film: boolean;
  host: string;
  subtitle: string;
  fileName: string;
};

const OUT_W = 1200;
const PAD = 32;
const HEAD = 112;
const FOOT = 48;
/** Длинный снимок телефона на 1200 px растянется до гигантской картинки — ограничиваем ширину кадра */
const MAX_SHOT_W = (width: number) => (width < 600 ? 520 : OUT_W - PAD * 2);

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Снимок не загрузился"));
    img.src = src;
  });
}

function token(root: HTMLElement, name: string) {
  return getComputedStyle(root).getPropertyValue(name).trim() || "#888";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

/** Картинка для клиента: шапка со сводкой, снимок с рамками, подпись сервиса. Всё на токенах страницы. */
export async function exportShot(input: ExportInput) {
  const { root, items, film } = input;
  const [img, heat] = await Promise.all([loadImage(input.shot), input.heat ? loadImage(input.heat) : null]);
  const shotW = MAX_SHOT_W(input.width);
  const scale = shotW / input.width;
  const shotH = Math.round(input.height * scale);
  const shotX = Math.round((OUT_W - shotW) / 2);
  const shotY = HEAD;
  const canvas = document.createElement("canvas");
  canvas.width = OUT_W;
  canvas.height = HEAD + shotH + FOOT;
  const ctx = canvas.getContext("2d")!;

  const ink = token(root, "--rg-ink");
  const colors: Record<OverlayGroup, string> = {
    ok: token(root, "--rg-ok"),
    dead: token(root, "--rg-dead"),
    check: token(root, "--rg-check"),
    unknown: token(root, "--rg-unknown"),
    attn: ink,
  };
  const bg = token(root, "--rg-bg");
  const muted = token(root, "--rg-muted");
  const heading = getComputedStyle(root.querySelector("h1") ?? root).fontFamily;
  const body = getComputedStyle(root).fontFamily;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = ink;
  ctx.font = `700 30px ${heading}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(input.host, PAD, 50);
  ctx.fillStyle = muted;
  ctx.font = `400 15px ${body}`;
  ctx.fillText(input.subtitle, PAD, 76);

  let x = PAD;
  ctx.font = `500 14px ${body}`;
  for (const entry of input.legend) {
    ctx.strokeStyle = colors[entry.group];
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, 88, 12, 12);
    ctx.fillStyle = ink;
    const text = entry.count === undefined ? entry.label : `${entry.label} ${entry.count}`;
    ctx.fillText(text, x + 20, 99);
    x += 20 + ctx.measureText(text).width + 24;
  }

  if (heat) {
    const srcH = (input.height / input.width) * img.naturalWidth;
    ctx.filter = "saturate(0.3) brightness(0.55)";
    ctx.drawImage(img, 0, 0, img.naturalWidth, srcH, shotX, shotY, shotW, shotH);
    ctx.filter = "none";
    ctx.drawImage(heat, shotX, shotY, shotW, shotH);
  } else {
    ctx.drawImage(img, shotX, shotY, shotW, shotH);
  }
  const problems = items.filter((item) => item.n !== null);
  if (film && problems.length) {
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.fillRect(shotX, shotY, shotW, shotH);
    for (const item of problems) {
      const { x: bx, y: by, w, h } = item.box;
      ctx.drawImage(img, (bx / input.width) * img.naturalWidth, (by / input.height) * img.naturalHeight, (w / input.width) * img.naturalWidth, (h / input.height) * img.naturalHeight, shotX + bx * scale, shotY + by * scale, w * scale, h * scale);
    }
  }

  const shown = film && problems.length ? problems : items;
  for (const item of shown) {
    const color = colors[item.group ?? GROUP_OF[item.kind]];
    const fx = shotX + item.box.x * scale;
    const fy = shotY + item.box.y * scale;
    const fw = Math.max(2, item.box.w * scale);
    const fh = Math.max(2, item.box.h * scale);
    ctx.strokeStyle = color;
    ctx.lineWidth = item.n === null ? 1 : 2;
    roundRect(ctx, fx, fy, fw, fh, 3);
    ctx.stroke();
    if (item.n !== null) {
      const label = String(item.n);
      ctx.font = `700 12px ${body}`;
      const tw = Math.max(20, ctx.measureText(label).width + 10);
      const ty = fy - 20 < shotY ? fy + 2 : fy - 20;
      ctx.fillStyle = color;
      roundRect(ctx, fx, ty, tw, 18, 4);
      ctx.fill();
      ctx.fillStyle = bg;
      ctx.textAlign = "center";
      ctx.fillText(label, fx + tw / 2, ty + 13);
      ctx.textAlign = "start";
    }
  }

  ctx.fillStyle = muted;
  ctx.font = `400 13px ${body}`;
  ctx.fillText("Рентген сайта · leads.konversus.ru/rentgen", PAD, canvas.height - 18);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new Error("Не удалось собрать картинку");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = input.fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}
