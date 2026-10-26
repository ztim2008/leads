import { GROUP_OF, GROUPS, type Group } from "@/lib/rentgen/groups";
import type { ClickItem } from "@/lib/rentgen/types";

type ExportInput = {
  root: HTMLElement;
  shot: string;
  width: number;
  height: number;
  items: Omit<ClickItem, "path">[];
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
  const img = await loadImage(input.shot);
  const shotW = MAX_SHOT_W(input.width);
  const scale = shotW / input.width;
  const shotH = Math.round(input.height * scale);
  const shotX = Math.round((OUT_W - shotW) / 2);
  const shotY = HEAD;
  const canvas = document.createElement("canvas");
  canvas.width = OUT_W;
  canvas.height = HEAD + shotH + FOOT;
  const ctx = canvas.getContext("2d")!;

  const colors: Record<Group, string> = {
    ok: token(root, "--rg-ok"),
    dead: token(root, "--rg-dead"),
    check: token(root, "--rg-check"),
    unknown: token(root, "--rg-unknown"),
  };
  const bg = token(root, "--rg-bg");
  const ink = token(root, "--rg-ink");
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

  const counts: Record<Group, number> = { ok: 0, dead: 0, check: 0, unknown: 0 };
  for (const item of items) counts[GROUP_OF[item.kind]] += 1;
  let x = PAD;
  ctx.font = `500 14px ${body}`;
  for (const group of GROUPS) {
    ctx.strokeStyle = colors[group.id];
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, 88, 12, 12);
    ctx.fillStyle = ink;
    const text = `${group.label} ${counts[group.id]}`;
    ctx.fillText(text, x + 20, 99);
    x += 20 + ctx.measureText(text).width + 24;
  }

  ctx.drawImage(img, shotX, shotY, shotW, shotH);
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
    const color = colors[GROUP_OF[item.kind]];
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
