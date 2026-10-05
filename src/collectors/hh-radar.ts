/**
 * Job Radar — сбор вакансий HH для админа.
 * Отдельный процесс. Заявки партнёров и Profi не трогает.
 */
import { loadHubEnv } from "@/lib/telegram/bot-token";
import { runRadarCycle } from "@/lib/radar/cycle";
import { startRadarInbox } from "@/lib/radar/inbox";

loadHubEnv();
startRadarInbox();

const INTERVAL_MS = 4 * 60 * 1000;

async function tick() {
  const started = Date.now();
  try {
    const result = await runRadarCycle();
    console.log(
      `[hh-radar] scanned=${result.scanned} fresh=${result.fresh} saved=${result.saved} notified=${result.notified}${result.error ? " error=" + result.error : ""}`,
    );
  } catch (e) {
    console.error("[hh-radar] tick", e instanceof Error ? e.message : e);
  }
  const jitter = Math.round(Math.random() * 60 * 1000);
  const wait = Math.max(30_000, INTERVAL_MS - (Date.now() - started) + jitter);
  setTimeout(tick, wait);
}

tick();
