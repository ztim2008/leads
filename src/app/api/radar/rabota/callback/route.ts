import { NextRequest, NextResponse } from "next/server";
import {
  exchangeRabotaCode,
  rabotaCredentials,
  rabotaMe,
  rabotaStateOk,
  saveRabotaToken,
} from "@/lib/radar/rabota-oauth";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function page(title: string, text: string, ok: boolean) {
  const body = `<!doctype html><html lang="ru"><meta charset="utf-8"><title>${escapeHtml(title)}</title><body style="font-family:sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p></body></html>`;
  return new NextResponse(body, {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: NextRequest) {
  const creds = rabotaCredentials();
  if (!creds) return page("Rabota.ru", "На сервере нет ключей приложения.", false);
  const code = req.nextUrl.searchParams.get("code")?.trim() || "";
  const state = req.nextUrl.searchParams.get("state");
  const denied = req.nextUrl.searchParams.get("error");
  if (denied) return page("Rabota.ru", "Доступ не выдан. Откройте ссылку ещё раз и разрешите профиль и вакансии.", false);
  if (!rabotaStateOk(state, creds.secret)) return page("Rabota.ru", "Ссылка авторизации устарела. Запросите новую.", false);
  if (!code) return page("Rabota.ru", "В адресе нет кода. Откройте ссылку входа с сервера.", false);
  try {
    const token = await exchangeRabotaCode(code, creds);
    saveRabotaToken(token.accessToken, token.expiresIn);
    const userId = await rabotaMe(token.accessToken, creds.appId);
    const who = userId ? ` Профиль ${userId}.` : "";
    return page("Rabota.ru подключена", `Токен сохранён на сервере.${who} Можно закрыть эту страницу.`, true);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось обменять код";
    return page("Rabota.ru", message, false);
  }
}
