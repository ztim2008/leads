import { NextRequest } from "next/server";
import { chromium } from "playwright";
import { getAuditView } from "@/lib/diagnost/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const view = await getAuditView(slug);
  if (!view || view.status !== "done") return new Response("Отчёт ещё не готов", { status: 404 });
  const kind = request.nextUrl.searchParams.get("kind") === "pro" ? "pro" : "client";

  // Печатная страница открывается только с локального сервера: адрес не зависит от заголовков запроса.
  const pageUrl = `http://127.0.0.1:${process.env.PORT || 3005}/diagnost/r/${slug}/print?kind=${kind}`;
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
    await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    const date = view.createdAt.slice(0, 10);
    const name = `audit-${view.host.replace(/[^a-z0-9.-]/gi, "")}-${kind === "pro" ? "internal" : "client"}-${date}.pdf`;
    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await browser.close();
  }
}
