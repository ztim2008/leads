#!/bin/bash
# 🩺 Доктор системы — проверяет и лечит ТОЛЬКО хаб (Next.js, БД)
# Phase 0: НЕ перезапускает Profi-коллектор (leads-profi удалён навсегда)
# См. docs/PHASE0_STABILIZATION.md

PROJECT_DIR="/var/www/www-root/data/www/leads.konversus.ru"
BOT_TOKEN="8924588782:AAGalvqpkASuXy2ZgmtlApk5W1HRxHKnmrg"
ADMIN_CHAT="778784292"
LOG="/var/log/leads-doctor.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }
notify() { curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" -d "chat_id=${ADMIN_CHAT}" -d "text=$1" -d "parse_mode=Markdown" -o /dev/null --max-time 5; }

HEALED=""
FAILED=""

# ─── 1. Лечим Next.js ──────────────────────────────────────────────────

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 http://localhost:3005/ 2>/dev/null)
if [ "$HTTP" != "200" ]; then
  log "🔴 Next.js не отвечает (HTTP $HTTP) — лечу..."
  pm2 restart leads-konversus 2>/dev/null
  sleep 5
  HTTP2=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 http://localhost:3005/ 2>/dev/null)
  if [ "$HTTP2" = "200" ]; then
    HEALED="${HEALED}✅ Next.js: перезапущен (${HTTP} → 200)\n"
  else
    FAILED="${FAILED}🔴 Next.js: НЕ СМОГ ВЫЛЕЧИТЬ (${HTTP} → ${HTTP2})\n"
  fi
else
  log "✅ Next.js: OK"
fi

# ─── 2. Profi на хабе — НЕ ТРОГАЕМ ────────────────────────────────────
# leads-profi удалён. Авто-рестарт Profi запрещён (инцидент 30.07.2026).
log "ℹ️ Profi hub collector: disabled by policy (Phase 0)"

# ─── 3. Проверяем БД ──────────────────────────────────────────────────

DB=$(cd "$PROJECT_DIR" && npx tsx -e "
const {PrismaClient}=require('@prisma/client');
new PrismaClient().\$connect().then(()=>{console.log('OK');process.exit(0)}).catch(()=>{console.log('ERR');process.exit(1)})
" 2>/dev/null)

if [ "$DB" != "OK" ]; then
  FAILED="${FAILED}🔴 База данных: недоступна\n"
  log "🔴 DB недоступна"
else
  log "✅ DB: доступна"
fi

# ─── 4. Источники с ошибками — только алерт, БЕЗ рестарта Profi ───────

ERROR_SRC=$(cd "$PROJECT_DIR" && npx tsx -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const sources=await p.source.findMany({where:{enabled:true,status:'error'},select:{platform:true,lastError:true}});
  if(sources.length>0){console.log(JSON.stringify(sources));process.exit(1)}
  process.exit(0)
})().catch(()=>process.exit(1))
" 2>/dev/null)

if [ $? != "0" ] && [ -n "$ERROR_SRC" ]; then
  log "🟡 Источники с ошибками: $ERROR_SRC (без авто-рестарта Profi)"
  FAILED="${FAILED}🟡 Источники с ошибками: ${ERROR_SRC}\n   Profi: проверьте VPS-агент вручную\n"
fi

# ─── Отчёт ────────────────────────────────────────────────────────────

if [ -n "$FAILED" ]; then
  notify "🛑 *Доктор: требуется внимание*
${FAILED}
${HEALED}"
  log "WARN: issues detected"
elif [ -n "$HEALED" ]; then
  notify "💊 *Доктор: вылечил хаб*
${HEALED}"
  log "HEALED: hub recovered"
else
  log "✅ Хаб в порядке"
fi

tail -500 "$LOG" > "${LOG}.tmp" 2>/dev/null && mv "${LOG}.tmp" "$LOG" 2>/dev/null
