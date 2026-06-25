// Эмуляция человеческого поведения — мышь, ввод текста, паузы
// Используется в profi.ts для максимальной имитации реального пользователя

import type { Page } from "playwright";

/**
 * Ввод текста как человек — с задержками между символами
 * Вместо page.fill() (мгновенная вставка) использует page.type() с вариативными интервалами
 */
export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.click(selector, { delay: 80 + Math.random() * 120 });
  await sleep(200 + Math.random() * 300);
  await page.fill(selector, "");
  await sleep(100 + Math.random() * 150);

  // Вводим символ за символом с человеческой скоростью
  for (let i = 0; i < text.length; i++) {
    const delay = 60 + Math.random() * 140; // 60-200ms между символами
    await page.type(selector, text[i], { delay });
    // Изредка пауза подлиннее — человек задумался или исправил
    if (Math.random() < 0.05 && i < text.length - 1) {
      await sleep(800 + Math.random() * 1200); // «задумался» на 0.8-2 сек
    }
  }
}

/**
 * Движение мыши по кривой к элементу + клик
 * Вместо page.click() (телепорт) использует реалистичную траекторию
 */
export async function humanClick(page: Page, selector: string): Promise<void> {
  const element = await page.$(selector);
  if (!element) {
    // fallback
    await page.click(selector);
    return;
  }

  const box = await element.boundingBox();
  if (!box) {
    await page.click(selector);
    return;
  }

  // Цель — случайная точка внутри элемента (не центр)
  const targetX = box.x + box.width * (0.2 + Math.random() * 0.6);
  const targetY = box.y + box.height * (0.2 + Math.random() * 0.6);

  // Текущая позиция мыши (или случайная стартовая)
  const startX = targetX - 100 + Math.random() * 200;
  const startY = targetY - 50 + Math.random() * 100;

  // Кривая Безье с 3 контрольными точками
  await mouseMoveBezier(page, startX, startY, targetX, targetY);

  // Маленькая пауза перед кликом (человек целится)
  await sleep(50 + Math.random() * 120);

  // Клик со случайной задержкой между mousedown/mouseup
  await page.mouse.click(targetX, targetY, { delay: 30 + Math.random() * 70 });
}

/**
 * Только движение мыши (без клика) — для ховеров и скролла
 */
export async function humanMoveMouse(page: Page, toX: number, toY: number): Promise<void> {
  // Случайная стартовая позиция
  const startX = toX - 150 + Math.random() * 300;
  const startY = toY - 100 + Math.random() * 200;
  await mouseMoveBezier(page, startX, startY, toX, toY);
}

/**
 * Скролл страницы с человеческой скоростью (пошагово, а не мгновенно)
 */
export async function humanScroll(page: Page, distanceY: number): Promise<void> {
  const steps = 3 + Math.floor(Math.random() * 5); // 3-7 шагов
  const stepSize = distanceY / steps;

  for (let i = 0; i < steps; i++) {
    const actualStep = stepSize * (0.6 + Math.random() * 0.8); // вариация
    await page.evaluate((y) => window.scrollBy(0, y), actualStep);
    await sleep(300 + Math.random() * 800); // 0.3-1.1 сек между шагами
  }
}

/**
 * Пауза (sleep) с человеческой вариативностью
 */
export function sleep(ms: number): Promise<void> {
  // Добавляем случайный джиттер ±15%
  const actual = ms * (0.85 + Math.random() * 0.3);
  return new Promise(resolve => setTimeout(resolve, actual));
}

/**
 * Кривая Безье между двумя точками — реалистичная траектория мыши
 */
async function mouseMoveBezier(
  page: Page,
  startX: number, startY: number,
  endX: number, endY: number
): Promise<void> {
  // Контрольные точки — случайное отклонение от прямой
  const cp1x = startX + (endX - startX) * 0.25 + (Math.random() - 0.5) * 100;
  const cp1y = startY + (endY - startY) * 0.25 + (Math.random() - 0.5) * 80;
  const cp2x = startX + (endX - startX) * 0.75 + (Math.random() - 0.5) * 100;
  const cp2y = startY + (endY - startY) * 0.75 + (Math.random() - 0.5) * 80;

  // Количество точек траектории — зависит от расстояния
  const dist = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
  const steps = Math.max(5, Math.min(30, Math.floor(dist / 20)));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Кривая Безье 3-го порядка
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

    // Вариативная скорость: быстрее в середине, медленнее в начале/конце
    const baseDelay = 5 + Math.random() * 8;
    const speedFactor = 0.5 + Math.abs(t - 0.5) * 1.5; // замедление на краях
    await sleep(baseDelay * speedFactor);
  }
}
