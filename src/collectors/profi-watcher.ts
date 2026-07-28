import { db } from "@/lib/db";
import { startWatching, stopAllWatching } from "@/lib/connectors/profi";
import { saveAndNotify, saveStatus } from "./shared";
import "@/lib/connectors/profi";

let totalLeads = 0;

async function main() {
  const sources = await db.source.findMany({
    where: { platform: "profi", enabled: true },
    include: { workspace: { include: { settings: true } } },
  });
  if (sources.length === 0) { console.log("[profi-watcher] No sources"); return; }

  for (const src of sources) {
    const cfg = src.config as any || {};
    const login = cfg.login || "?";
    const s = src.workspace.settings;
    const respTemplate = s?.responseTemplate || "";

    console.log("[profi-watcher] Starting watcher for " + login);

    startWatching(src.id, cfg, cfg.keywords || s?.keywords || "", {
      onLead: async (lead: any) => {
        const extId = lead.externalId;
        const exists = extId ? await db.lead.findUnique({ where: { externalId: extId } }) : null;
        if (exists) return;
        const respText = respTemplate ? respTemplate.replace(/{имя}/g, lead.author || "").replace(/{задача}/g, lead.title || "").replace(/{город}/g, lead.city || "").replace(/{бюджет}/g, lead.budgetMin ? lead.budgetMin + " ₽" : "") : "";
        await saveAndNotify(lead, { id: src.id, workspaceId: src.workspaceId, platform: "profi", color: src.color || "#22c55e" }, s, respText);
        totalLeads++;
        saveStatus({ profi: { running: true, totalLeads, lastCheck: new Date().toISOString() } });
      },
      onError: (err: string) => { console.error("[profi-watcher] " + login + ": " + err); },
      onStatus: (status: string) => {
        saveStatus({ profi: { running: true, totalLeads, status, lastCheck: new Date().toISOString() } });
      },
    }, cfg.workHoursStart, cfg.workHoursEnd);
  }
  console.log("[profi-watcher] " + sources.length + " watchers running");
}

main().catch(e => { console.error(e); process.exit(1); });
process.on("SIGINT", () => { stopAllWatching(); process.exit(0); });
process.on("SIGTERM", () => { stopAllWatching(); process.exit(0); });
