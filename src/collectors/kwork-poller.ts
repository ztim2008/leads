import { db } from "@/lib/db";
import { kworkConnector } from "@/lib/connectors/kwork";
import { saveAndNotify, saveStatus, mskNow } from "./shared";
import "@/lib/connectors/kwork";

let totalLeads = 0;

async function poll() {
  const src = await db.source.findFirst({
    where: { platform: "kwork", enabled: true },
    include: { workspace: { include: { settings: true } } },
  });
  if (!src) { console.log("[kwork-poller] No source"); setTimeout(poll, 60000); return; }

  const cfg = src.config as any || {};
  const whStart = cfg.workHoursStart || "00:00";
  const whEnd = cfg.workHoursEnd || "23:59";
  const now = mskNow();
  const mins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = whStart.split(":").map(Number);
  const [eh, em] = whEnd.split(":").map(Number);

  if (mins < sh * 60 + sm || mins > eh * 60 + em) {
    const waitMins = mins < sh * 60 + sm ? (sh * 60 + sm - mins) : (24 * 60 - mins + sh * 60 + sm);
    console.log("[kwork-poller] Outside hours, wait " + Math.round(waitMins / 60) + "h");
    setTimeout(poll, waitMins * 60000);
    return;
  }

  const s = src.workspace.settings;
  let newLeads = 0;
  try {
    const leads = await kworkConnector.fetchLeads(src.config as any);
    for (const lead of leads) {
      const extId = lead.externalId;
      const exists = extId ? await db.lead.findUnique({ where: { externalId: extId } }) : null;
      if (exists) continue;
      await saveAndNotify(lead, { id: src.id, workspaceId: src.workspaceId, platform: "kwork", color: src.color || "#f97316" }, s);
      newLeads++;
      totalLeads++;
      await new Promise(r => setTimeout(r, 300));
    }
  } catch (e: any) { console.error("[kwork-poller] Error: " + e.message); }

  saveStatus({ kwork: { running: true, totalLeads, newLeads, lastCheck: new Date().toISOString() } });
  const nextMs = (2 + Math.random() * 8) * 60000;
  console.log("[kwork-poller] " + newLeads + " new, next in " + Math.round(nextMs / 60000) + "min");
  setTimeout(poll, nextMs);
}

poll().catch(e => { console.error(e); setTimeout(poll, 60000); });
