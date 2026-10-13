/**
 * Стратег — фоновый разбор сайтов для брифа.
 * Не пишет в Lead и не трогает Job Radar / Profi.
 */
import { loadHubEnv } from "@/lib/telegram/bot-token";
import { claimNextBriefRun, processBriefRun } from "@/lib/briefs/run";

loadHubEnv();

const IDLE_MS = 4000;

async function tick() {
  try {
    const runId = await claimNextBriefRun();
    if (runId) {
      await processBriefRun(runId);
      setTimeout(tick, 200);
      return;
    }
  } catch (error) {
    console.error("[briefs]", error instanceof Error ? error.message : error);
  }
  setTimeout(tick, IDLE_MS);
}

tick();
