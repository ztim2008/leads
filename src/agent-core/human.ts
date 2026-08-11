/**
 * Human-like Playwright interactions — from src/lib/stealth/human.ts.
 * Used only on VPS agent, never on hub for Profi.
 */

import type { Page } from "playwright";
import { sleep } from "./profiles";

export { sleep };

export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.click(selector, { delay: 80 + Math.random() * 120 });
  await sleep(200 + Math.random() * 300);
  await page.fill(selector, "");
  await sleep(100 + Math.random() * 150);

  for (let i = 0; i < text.length; i++) {
    const delay = 60 + Math.random() * 140;
    await page.type(selector, text[i], { delay });
    if (Math.random() < 0.05 && i < text.length - 1) {
      await sleep(800 + Math.random() * 1200);
    }
  }
}

export async function humanClick(page: Page, selector: string): Promise<void> {
  const element = await page.$(selector);
  if (!element) {
    await page.click(selector);
    return;
  }

  const box = await element.boundingBox();
  if (!box) {
    await page.click(selector);
    return;
  }

  const targetX = box.x + box.width * (0.2 + Math.random() * 0.6);
  const targetY = box.y + box.height * (0.2 + Math.random() * 0.6);
  const startX = targetX - 100 + Math.random() * 200;
  const startY = targetY - 50 + Math.random() * 100;

  await mouseMoveBezier(page, startX, startY, targetX, targetY);
  await sleep(50 + Math.random() * 120);
  await page.mouse.click(targetX, targetY, { delay: 30 + Math.random() * 70 });
}

export async function humanMoveMouse(page: Page, toX: number, toY: number): Promise<void> {
  const startX = toX - 150 + Math.random() * 300;
  const startY = toY - 100 + Math.random() * 200;
  await mouseMoveBezier(page, startX, startY, toX, toY);
}

export async function humanScroll(page: Page, distanceY: number): Promise<void> {
  const steps = 3 + Math.floor(Math.random() * 5);
  const stepSize = distanceY / steps;

  for (let i = 0; i < steps; i++) {
    const actualStep = stepSize * (0.6 + Math.random() * 0.8);
    await page.evaluate((y) => window.scrollBy(0, y), actualStep);
    await sleep(300 + Math.random() * 800);
  }
}

async function mouseMoveBezier(
  page: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): Promise<void> {
  const cp1x = startX + (endX - startX) * 0.25 + (Math.random() - 0.5) * 100;
  const cp1y = startY + (endY - startY) * 0.25 + (Math.random() - 0.5) * 80;
  const cp2x = startX + (endX - startX) * 0.75 + (Math.random() - 0.5) * 100;
  const cp2y = startY + (endY - startY) * 0.75 + (Math.random() - 0.5) * 80;

  const dist = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
  const steps = Math.max(5, Math.min(30, Math.floor(dist / 20)));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x =
      (1 - t) ** 3 * startX +
      3 * (1 - t) ** 2 * t * cp1x +
      3 * (1 - t) * t ** 2 * cp2x +
      t ** 3 * endX;
    const y =
      (1 - t) ** 3 * startY +
      3 * (1 - t) ** 2 * t * cp1y +
      3 * (1 - t) * t ** 2 * cp2y +
      t ** 3 * endY;

    await page.mouse.move(x, y);
    const baseDelay = 5 + Math.random() * 8;
    const speedFactor = 0.5 + Math.abs(t - 0.5) * 1.5;
    await sleep(baseDelay * speedFactor);
  }
}
