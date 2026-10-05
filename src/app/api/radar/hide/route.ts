import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { appBaseUrl, verifyVacancyHide } from "@/lib/radar/sign";

function page(title: string, body: string) {
  const href = `${appBaseUrl()}/dashboard/radar`;
  const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:Inter,system-ui,sans-serif;padding:32px;line-height:1.5"><h1 style="font-size:22px">${title}</h1><p>${body}</p><p><a href="${href}">Открыть радар</a></p></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/** Ссылка из Telegram. Подпись вместо сессии: кнопка открывается с телефона. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  const sig = req.nextUrl.searchParams.get("sig") || "";
  if (!id || !verifyVacancyHide(id, sig)) return page("Ссылка недействительна", "Эту вакансию скрыть не получилось.");
  await db.jobVacancy.update({ where: { id }, data: { status: "hidden" } }).catch(() => null);
  return page("Вакансия скрыта", "Пушей по ней больше не будет.");
}
