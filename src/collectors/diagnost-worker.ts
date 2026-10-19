/**
 * Техосмотр сайта (/diagnost) — фоновые аудиты по очереди.
 * Не пишет в Lead и не трогает Job Radar / Profi.
 */
import { loadHubEnv } from "@/lib/telegram/bot-token";
import { claimNextAudit, processAudit } from "@/lib/diagnost/run";

loadHubEnv();

const IDLE_MS = 2000;

async function tick() {
  try {
    const id = await claimNextAudit();
    if (id) {
      await processAudit(id);
      setTimeout(tick, 100);
      return;
    }
  } catch (error) {
    console.error("[diagnost]", error instanceof Error ? error.message : error);
  }
  setTimeout(tick, IDLE_MS);
}

tick();
