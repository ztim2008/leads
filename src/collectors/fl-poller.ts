/**
 * FL.ru — анонимный сбор заказов на хабе, один процесс на всех партнёров (PM2 `leads-fl`).
 *
 *   • Публичная лента fl.ru/projects/ обычным HTTP: без браузера, без аккаунтов партнёров
 *   • Пауза 1/3/6 мин ±20% (как YouDo), ночью спим
 *   • Новый заказ → страница проекта (полный текст) → saveAndNotify в каждый включённый fl-источник
 *     со своими фильтрами. externalId уникален на источник: fl-<id>-<sourceId8>
 *   • Первый запуск: текущая лента помечается просмотренной, в Telegram не льём
 *   • CircuitBreaker: 3 ошибки за 10 мин → пауза 60 мин. Сторож — leads-health
 */
import os from "node:os";
import path from "node:path";
import { db } from "@/lib/db";
import { saveAndNotify } from "@/collectors/shared";
import { loadHubEnv } from "@/lib/telegram/bot-token";
import { patchSourceAgentMeta } from "@/lib/agent/source-config";
import { CircuitBreaker } from "@/agent-core/circuit-breaker";
import { readJsonFile, writeJsonFile } from "@/agent-core/paths";
import { pickPollDelayMs } from "@/agent-core/poll-steps";
import {
  FL_ORIGIN,
  flCategoryPasses,
  isFlOrder,
  parseFlCategory,
  parseFlDescription,
  parseFlList,
  type FlCard,
} from "@/lib/connectors/fl";

type FlCategory = ReturnType<typeof parseFlCategory>;

loadHubEnv();

const HOME = path.join(os.homedir(), ".leads-hub", "fl");
const SEEN_PATH = path.join(HOME, "seen.json");
const SEEN_MAX = 3000;
const WORK_START_H = 7;
const WORK_END_H = 23;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const STARTED = Date.now();

interface SeenState {
  ids: string[];
  seededAt: number | null;
}

const breaker = new CircuitBreaker({
  statePath: path.join(HOME, "circuit-breaker.json"),
  onStateChange: (prev, next) => console.warn(`[fl] circuit ${prev} → ${next}`),
});

let seen: SeenState = readJsonFile<SeenState>(SEEN_PATH, { ids: [], seededAt: null });
const seenSet = new Set(seen.ids);
let lastFeedOkAt: string | null = null;
let lastError: string | null = null;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function mskHour(now = Date.now()) {
  return new Date(now + 3 * 3600_000).getUTCHours();
}

function remember(ids: string[]) {
  for (const id of ids) seenSet.add(id);
  const all = [...seenSet];
  seen = { ids: all.slice(-SEEN_MAX), seededAt: seen.seededAt ?? Date.now() };
  if (all.length > SEEN_MAX) {
    seenSet.clear();
    seen.ids.forEach((id) => seenSet.add(id));
  }
  writeJsonFile(SEEN_PATH, seen);
}

async function get(url: string, referer?: string): Promise<{ status: number; html: string }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.6",
      ...(referer ? { Referer: referer } : {}),
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  return { status: res.status, html: await res.text() };
}

async function fetchFeed(): Promise<{ ok: true; cards: FlCard[] } | { ok: false; reason: string }> {
  try {
    const { status, html } = await get(`${FL_ORIGIN}/projects/`);
    if (status !== 200) return { ok: false, reason: `http_${status}` };
    const cards = parseFlList(html);
    if (!cards.length) return { ok: false, reason: /captcha|challenge/i.test(html) ? "captcha" : "no_cards" };
    return { ok: true, cards };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message.slice(0, 80) : "fetch_error" };
  }
}

async function loadSources() {
  return db.source.findMany({
    where: { platform: "fl", enabled: true },
    include: { workspace: { include: { settings: true } } },
  });
}

type FlSource = Awaited<ReturnType<typeof loadSources>>[number];

async function fanOut(card: FlCard, description: string, category: FlCategory, sources: FlSource[]): Promise<number> {
  let saved = 0;
  for (const src of sources) {
    const cfg = (src.config as Record<string, unknown>) || {};
    if (!flCategoryPasses(category, cfg)) continue;
    const lead = {
      externalId: `fl-${card.id}-${src.id.slice(0, 8)}`,
      title: card.title,
      description,
      budgetMin: card.budgetMin,
      budgetMax: card.budgetMax,
      url: card.url,
      responses: card.responses ?? undefined,
      remote: true,
      createdAt: new Date().toISOString(),
    };
    const meta = { id: src.id, workspaceId: src.workspaceId, platform: "fl", color: src.color };
    try {
      if (await saveAndNotify(lead, meta, { ...src.workspace.settings, config: cfg })) saved++;
    } catch (e) {
      console.error("[fl] save", src.id.slice(0, 8), e instanceof Error ? e.message : e);
    }
  }
  return saved;
}

async function heartbeat(sources: FlSource[], extra: Record<string, unknown> = {}) {
  const patch = {
    _lastHeartbeat: new Date().toISOString(),
    _agentUptime: Math.round((Date.now() - STARTED) / 1000),
    _lastFeedOkAt: lastFeedOkAt,
    _circuitBreaker: breaker.getState(),
    _lastError: lastError,
    ...extra,
  };
  for (const s of sources) await patchSourceAgentMeta(s.id, patch).catch(() => {});
}

async function cycle(sources: FlSource[]) {
  const feed = await fetchFeed();
  if (!feed.ok) {
    lastError = feed.reason;
    breaker.recordFailure(feed.reason);
    console.warn(`[fl] feed fail: ${feed.reason} · cb=${breaker.getState().state}`);
    return;
  }
  breaker.recordSuccess();
  lastError = null;
  lastFeedOkAt = new Date().toISOString();

  if (!seen.seededAt) {
    remember(feed.cards.map((c) => c.id));
    console.log(`[fl] seeded ${feed.cards.length} cards, no send`);
    return;
  }

  const fresh = feed.cards.filter((c) => !seenSet.has(c.id));
  let saved = 0;
  for (const card of fresh) {
    if (isFlOrder(card)) {
      await sleep(1500 + Math.random() * 2500);
      let description = card.snippet;
      let category: FlCategory = null;
      try {
        const page = await get(card.url, `${FL_ORIGIN}/projects/`);
        if (page.status === 200) {
          description = parseFlDescription(page.html, card.id) || card.snippet;
          category = parseFlCategory(page.html);
        }
      } catch {}
      saved += await fanOut(card, description, category, sources);
    }
    remember([card.id]);
  }
  console.log(`[fl] cards=${feed.cards.length} new=${fresh.length} saved=${saved} sources=${sources.length}`);
}

async function main() {
  console.log("[fl] start, state", HOME);
  for (;;) {
    let wait = 5 * 60_000;
    try {
      const sources = await loadSources();
      const h = mskHour();
      if (!sources.length) {
        wait = 10 * 60_000;
      } else if (h < WORK_START_H || h >= WORK_END_H) {
        await heartbeat(sources, { _agentState: "sleeping" });
        wait = 10 * 60_000;
      } else if (!breaker.canAttempt()) {
        await heartbeat(sources, { _agentState: "paused_cb" });
        wait = 5 * 60_000;
      } else {
        await cycle(sources);
        await heartbeat(sources, { _agentState: "running" });
        wait = pickPollDelayMs();
      }
    } catch (e) {
      console.error("[fl] loop", e instanceof Error ? e.message : e);
    }
    await sleep(wait);
  }
}

main();
