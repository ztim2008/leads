import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

async function adminDelivery(): Promise<{ token: string; chat: string }> {
  const admin = await db.settings.findFirst({
    where: { telegramToken: { not: null }, telegramChatId: { not: null }, workspace: { user: { role: "admin" } } },
    select: { telegramToken: true, telegramChatId: true },
  });
  return {
    token: (admin?.telegramToken || process.env.TELEGRAM_BOT_TOKEN || "").trim(),
    chat: (admin?.telegramChatId || process.env.TELEGRAM_ADMIN_CHAT_ID || "").trim(),
  };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "Пустой запрос" }, { status: 400 });

  if (str(body.website, 200)) return NextResponse.json({ ok: true });

  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown").split(",")[0].trim();
  if (limited(ip)) {
    return NextResponse.json({ ok: false, error: "Слишком много заявок с вашего адреса, попробуйте позже" }, { status: 429 });
  }

  const a = {
    niche: str(body.niche, 120),
    city: str(body.city, 80),
    site: str(body.site, 40),
    siteUrl: str(body.siteUrl, 200),
    sources: Array.isArray(body.sources) ? body.sources.slice(0, 10).map((s) => str(s, 40)).filter(Boolean) : [],
    goal: str(body.goal, 80),
    budget: str(body.budget, 40),
    name: str(body.name, 60),
    contact: str(body.contact, 60),
    comment: str(body.comment, 500),
  };

  if (a.niche.length < 2 || !a.name || a.contact.length < 4) {
    return NextResponse.json({ ok: false, error: "Заполните услугу, имя и контакт" }, { status: 400 });
  }

  const lines = [
    "<b>Опрос SEO — новая заявка</b>",
    "",
    `<b>Бизнес:</b> ${esc(a.niche)}${a.city ? `, ${esc(a.city)}` : ""}`,
    `<b>Сайт:</b> ${esc(a.site || "—")}${a.siteUrl ? ` · ${esc(a.siteUrl)}` : ""}`,
    `<b>Клиенты сейчас:</b> ${esc(a.sources.join(", ") || "—")}`,
    `<b>Цель:</b> ${esc(a.goal || "—")}`,
    `<b>Бюджет в месяц:</b> ${esc(a.budget || "—")}`,
    "",
    `<b>Имя:</b> ${esc(a.name)}`,
    `<b>Контакт:</b> ${esc(a.contact)}`,
  ];
  if (a.comment) lines.push(`<b>Комментарий:</b> ${esc(a.comment)}`);
  lines.push("", "leads.konversus.ru/seo");

  const { token, chat } = await adminDelivery();
  if (!token || !chat) {
    console.error("[seo-brief] нет бота или чата админа");
    return NextResponse.json({ ok: false, error: "Не получилось отправить" }, { status: 502 });
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: lines.join("\n"), parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10000),
    });
    const d = (await r.json()) as { ok?: boolean; description?: string };
    if (!d.ok) throw new Error(d.description || `HTTP ${r.status}`);
  } catch (error) {
    console.error("[seo-brief] telegram:", error);
    return NextResponse.json({ ok: false, error: "Не получилось отправить" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
