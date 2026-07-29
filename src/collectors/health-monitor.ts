// Health Monitor v2 — только проверки и пульс партнёрам
// Рестарты отслеживает cron: /opt/health-check.sh
// PM2 политики: ecosystem.config.cjs

import { db } from "@/lib/db";

const CHECK_MINUTES = 5;
const CHECK_MS = CHECK_MINUTES * 60 * 1000;

type AlertKey = string;
const lastAlert: Record<AlertKey, number> = {};

function cooldown(key: AlertKey, ms: number): boolean {
  const now = Date.now();
  if (lastAlert[key] && now - lastAlert[key] < ms) return false;
  lastAlert[key] = now;
  return true;
}

function mskHour() { return new Date(Date.now() + 3*3600*1000).getUTCHours(); }
function mskTime() { return new Date(Date.now() + 3*3600*1000).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}); }

async function tg(token: string, chat: string, text: string) {
  if (!token || !chat) return;
  try { await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:chat,text,parse_mode:"Markdown"}),signal:AbortSignal.timeout(8000)}); } catch {}
}

// ─── Проверки ─────────────────────────────────

async function dbOk() { try { await db.$queryRaw`SELECT 1`; return true; } catch { return false; } }

async function tgOk() { try { return (await fetch("https://api.telegram.org/",{signal:AbortSignal.timeout(5000)})).ok; } catch { return false; } }

async function leadsInfo() {
  try {
    const cnt = await db.lead.count({where:{createdAt:{gte:new Date(Date.now()-3600*1000)}}});
    const last = await db.lead.findFirst({orderBy:{createdAt:"desc"},select:{createdAt:true}});
    return {count:cnt, lastMin:last?Math.floor((Date.now()-new Date(last.createdAt).getTime())/60000):null};
  } catch { return {count:-1,lastMin:null}; }
}

async function getAdmin() {
  try {
    const ws = await db.workspace.findFirst({where:{name:"Моё пространство"},include:{settings:true}});
    return {token:ws?.settings?.telegramToken||"",chat:ws?.settings?.telegramChatId||""};
  } catch { return {token:"",chat:""}; }
}

async function getPartners() {
  try {
    const wss = await db.workspace.findMany({include:{user:{select:{email:true}},settings:{select:{telegramChatId:true,telegramToken:true}},_count:{select:{leads:true}}}});
    const today = new Date(); today.setHours(0,0,0,0);
    const res = [];
    for (const w of wss) {
      const t = await db.lead.count({where:{workspaceId:w.id,createdAt:{gte:today}}});
      res.push({name:w.name,email:w.user?.email||"?",chat:w.settings?.telegramChatId,token:w.settings?.telegramToken,today:t,total:w._count.leads});
    }
    return res;
  } catch { return []; }
}

// ─── Пульс ────────────────────────────────────

async function partnerPulse() {
  const h = mskHour();
  if (h < 8 || h > 20 || h % 3 !== 0) return;
  if (!cooldown("pulse_"+h, 150*60000)) return;
  const partners = await getPartners();
  const {lastMin} = await leadsInfo();
  for (const p of partners) {
    if (!p.token || !p.chat) continue;
    await tg(p.token, p.chat, [
      `💚 *Leads AI — проверка связи* ${mskTime()} МСК`,
      `📥 Сегодня: *${p.today}* · Всего: *${p.total}*`,
      `⏱ Последняя заявка: ${lastMin!=null?lastMin+" мин назад":"—"}`,
      `🟢 Система работает штатно`,
    ].join("\n"));
  }
}

async function partnerHeartbeat() {
  const h = mskHour();
  if (h < 8 || h > 20 || h % 3 === 0) return;
  if (!cooldown("hb_"+h, 55*60000)) return;
  for (const p of await getPartners()) {
    if (!p.token || !p.chat) continue;
    await tg(p.token, p.chat, `🟢 *Leads AI — на связи* ${mskTime()} МСК\nСистема работает, ждун активен.`);
  }
}

// ─── Главный цикл ─────────────────────────────

async function check() {
  const dbUp = await dbOk();
  const tgUp = await tgOk();
  const leads = await leadsInfo();
  const admin = await getAdmin();

  // Алерты админу
  if (!dbUp && cooldown("db", 15*60000)) await tg(admin.token, admin.chat, "🔴 *БД недоступна!*");
  if (!tgUp && cooldown("tg", 15*60000)) await tg(admin.token, admin.chat, "🔴 *Telegram API недоступен!*");
  if (leads.lastMin && leads.lastMin > 60 && cooldown("silent", 60*60000)) {
    await tg(admin.token, admin.chat, `🔴 *Нет заявок > ${leads.lastMin} мин*\nПроверь сессии Profi.`);
  }

  await partnerPulse();
  await partnerHeartbeat();

  const s = [dbUp?"DB":"!!DB", tgUp?"TG":"!!TG", "leads:"+leads.count].join(" ");
  console.log("[health]", s, "next in", CHECK_MINUTES, "min");
}

console.log("[health] v2 started, interval:", CHECK_MINUTES, "min");
check();
setInterval(check, CHECK_MS);
