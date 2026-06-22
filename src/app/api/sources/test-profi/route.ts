import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { chromium } from "playwright";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sourceId, login, password } = await req.json();

  if (!login || !password) {
    return NextResponse.json({ ok: false, error: "Введите логин и пароль Profi.ru" }, { status: 400 });
  }

  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    // Шаг 1: открываем страницу входа
    await page.goto("https://profi.ru/backoffice/n.php", { waitUntil: "domcontentloaded", timeout: 30000 });

    // Шаг 2: ждём форму
    const loginInput = await page.waitForSelector('[data-testid="auth_login_input"]', { timeout: 15000 }).catch(() => null);
    if (!loginInput) {
      await browser.close();
      return NextResponse.json({ ok: false, error: "Не удалось найти форму входа на Profi.ru. Возможно сайт изменился." });
    }

    // Шаг 3: заполняем
    await page.fill('[data-testid="auth_login_input"]', login);
    await page.locator('input[type="password"]').first().fill(password);
    await page.click('[data-testid="enter_with_sms_btn"]');

    // Шаг 4: ждём результат
    await page.waitForTimeout(6000);

    const url = page.url();
    const bodyText = await page.locator("body").innerText();

    await browser.close();

    // Анализируем результат
    if (bodyText.includes("Некорректный логин") || bodyText.includes("Некорректный пароль")) {
      return NextResponse.json({
        ok: false,
        error: "Неверный логин или пароль. Проверьте данные из Настройки анкеты → Логин.",
        status: "auth_error",
      });
    }

    if (url.includes("login") || url.includes("auth")) {
      return NextResponse.json({
        ok: false,
        error: "Не удалось войти. Возможно, требуется подтверждение по SMS или капча.",
        status: "auth_redirect",
      });
    }

    // Успех! Активируем источник если был pending
    if (sourceId) {
      await db.source.update({ where: { id: sourceId }, data: { status: "active", enabled: true, lastError: null } }).catch(() => {});
    }
    return NextResponse.json({
      ok: true,
      message: "Подключение установлено! Логин и пароль верны. Источник активирован.",
      status: "connected",
    });
  } catch (err: any) {
    if (browser) await browser.close().catch(() => {});
    const msg = err.message || "Неизвестная ошибка";
    if (msg.includes("timeout")) {
      return NextResponse.json({ ok: false, error: "Profi.ru не отвечает. Проверьте интернет или попробуйте позже." });
    }
    return NextResponse.json({ ok: false, error: `Ошибка соединения: ${msg.slice(0, 200)}` });
  }
}
