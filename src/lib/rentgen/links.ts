import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPrivateIp } from "@/lib/briefs/fetch-site";
import { CHROME_UA } from "@/lib/diagnost/render";

export type LinkCheck = {
  status: number | null;
  /** dns — домена нет; blocked — внутренний адрес; timeout / network — не ответил */
  error: "dns" | "blocked" | "timeout" | "network" | null;
};

const MAX_LINKS = 60;
const CONCURRENCY = 6;
const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 5;

async function resolveHost(hostname: string): Promise<LinkCheck["error"]> {
  try {
    if (isIP(hostname)) return isPrivateIp(hostname) ? "blocked" : null;
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (!records.length) return "dns";
    return records.some((record) => isPrivateIp(record.address)) ? "blocked" : null;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "ENOTFOUND" || code === "ENODATA" ? "dns" : "network";
  }
}

async function request(url: string, method: "HEAD" | "GET"): Promise<Response> {
  return fetch(url, {
    method,
    redirect: "manual",
    headers: { "User-Agent": CHROME_UA, Accept: "text/html,*/*", ...(method === "GET" ? { Range: "bytes=0-0" } : {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

async function checkOne(start: string): Promise<LinkCheck> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { status: null, error: "network" };
    }
    if (!/^https?:$/.test(parsed.protocol)) return { status: null, error: "blocked" };
    const hostError = await resolveHost(parsed.hostname);
    if (hostError) return { status: null, error: hostError };
    try {
      let res = await request(url, "HEAD");
      if (res.status === 405 || res.status === 501 || res.status >= 400) {
        await res.body?.cancel().catch(() => undefined);
        res = await request(url, "GET");
      }
      await res.body?.cancel().catch(() => undefined);
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        url = new URL(location, url).toString();
        continue;
      }
      return { status: res.status, error: null };
    } catch (error) {
      const name = (error as Error).name;
      return { status: null, error: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network" };
    }
  }
  return { status: null, error: "network" };
}

/** Внутренние ссылки — первыми: их ошибки важнее, внешние сайты чаще режут ботов. */
export function pickLinks(urls: string[], siteUrl: string): string[] {
  const host = new URL(siteUrl).hostname.replace(/^www\./, "");
  const unique = [...new Set(urls.map((url) => url.split("#")[0]).filter((url) => /^https?:/i.test(url)))];
  const internal = unique.filter((url) => new URL(url).hostname.replace(/^www\./, "") === host);
  const external = unique.filter((url) => !internal.includes(url));
  return [...internal, ...external].slice(0, MAX_LINKS);
}

export async function checkLinks(urls: string[]): Promise<Map<string, LinkCheck>> {
  const results = new Map<string, LinkCheck>();
  const queue = [...urls];
  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) results.set(url, await checkOne(url));
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}
