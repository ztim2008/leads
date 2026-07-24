// Kwork.ru connector - Playwright list + HTTP pages
// No login, no anti-detect, no stealth needed
import { chromium } from "playwright";
import type { Connector, ConnectorConfig, NormalizedLead } from "./types";
import { registerConnector } from "./types";

interface KworkConfig extends ConnectorConfig {
  categories?: string; keywords?: string; budgetMin?: number; budgetMax?: number;
}

const BASE = "https://kwork.ru";
const CATS = ["11", "41", "1", "7", "24", "25"];

async function fetchPage(id: string): Promise<string | null> {
  try {
    const r = await fetch(BASE + "/projects/" + id, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
    return r.ok ? r.text() : null;
  } catch { return null; }
}

function parsePage(html: string) {
  const bm = html.match(/\u0416\u0435\u043b\u0430\u0435\u043c\u044b\u0439 \u0431\u044e\u0434\u0436\u0435\u0442:\s*(?:\u0434\u043e\s*)?(\d[\d\s]*)\s*\u20bd/i);
  let budget: number | undefined, budgetMax: number | undefined;
  if (bm) { const v = parseInt(bm[1].replace(/\s/g, ""), 10); if (bm[0].includes("\u0434\u043e")) budgetMax = v; else budget = v; }
  
  let body = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "").replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "").replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/[\r\n]+/g, "\n").replace(/ {2,}/g, " ");
  
  const ti = body.indexOf("\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439 \u043e\u043d\u043b\u0430\u0439\u043d");
  if (ti > 0) body = body.slice(ti + 40);
  const fe = Math.min(...["\u0423\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u0435", "\u0424\u0440\u0438\u043b\u0430\u043d\u0441 \u0431\u0438\u0440\u0436\u0430", "\u0420\u0443\u0431\u0440\u0438\u043a\u0438"].map(f => { const i = body.indexOf(f); return i > 0 ? i : 99999; }));
  if (fe < 99999) body = body.slice(0, fe);
  return { budget, budgetMax, desc: body.replace(/\n{3,}/g, "\n\n").trim().slice(0, 2000) };
}

function matchKW(text: string, kw?: string): boolean {
  if (!kw) return true;
  const w = kw.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
  return w.length === 0 || w.some((k: string) => text.toLowerCase().includes(k));
}

export const kworkConnector: Connector = {
  platform: "kwork", name: "Kwork.ru",
  validateConfig: () => true,
  async fetchLeads(config: ConnectorConfig): Promise<NormalizedLead[]> {
    const c = config as KworkConfig;
    const cats = (c.categories || CATS.join(",")).split(",").map((s: string) => s.trim()).filter(Boolean);
    const leads: NormalizedLead[] = [];
    const seen = new Set<string>();
    let browser: any = null;
    try {
      browser = await chromium.launch({ headless: true, timeout: 20000 });
      for (const cat of cats.slice(0, 3)) {
        try {
          const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
          const page = await ctx.newPage();
          await page.goto(BASE + "/projects?c=" + cat, { waitUntil: "networkidle", timeout: 20000 });
          await page.waitForTimeout(3000);
          const projs: { id: string; title: string }[] = await page.evaluate(() => {
            const res: { id: string; title: string }[] = [];
            const s = new Set<string>();
            document.querySelectorAll("a[href]").forEach(a => { const m = (a as HTMLAnchorElement).href.match(/\/projects\/(\d{7,})/); if (m && !s.has(m[1])) { s.add(m[1]); const t = (a as HTMLElement).innerText?.trim()?.split("\n")[0]?.slice(0,150) || ""; if (t.length > 3) res.push({ id: m[1], title: t }); } });
            return res;
          });
          console.log("[kwork] cat " + cat + ": " + projs.length + " projects");
          await ctx.close();
          for (const p of projs.slice(0, 25)) {
            if (seen.has(p.id)) continue; seen.add(p.id);
            if (!matchKW(p.title, c.keywords)) continue;
            try {
              const h = await fetchPage(p.id); if (!h) continue;
              const d = parsePage(h); const b = d.budget || d.budgetMax;
              if (c.budgetMin && b && b < c.budgetMin) continue;
              if (c.budgetMax && b && b > c.budgetMax) continue;
              leads.push({ externalId: "kwork-" + p.id, title: p.title.slice(0,150), description: d.desc, budgetMin: d.budget, budgetMax: d.budgetMax, url: BASE + "/projects/" + p.id, createdAt: new Date().toISOString() });
            } catch { leads.push({ externalId: "kwork-" + p.id, title: p.title.slice(0,150), description: "", url: BASE + "/projects/" + p.id, createdAt: new Date().toISOString() }); }
            await new Promise(r => setTimeout(r, 800 + Math.random() * 700));
          }
        } catch (e: any) { console.error("[kwork] cat err: " + e.message); }
      }
    } catch (e: any) { console.error("[kwork] browser err: " + e.message); }
    finally { if (browser) await browser.close().catch(() => {}); }
    console.log("[kwork] total: " + leads.length);
    return leads;
  }
};

registerConnector(kworkConnector);
