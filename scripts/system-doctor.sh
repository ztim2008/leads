#!/bin/bash
# 🩺 Доктор системы — проверяет и ЛЕЧИТ автоматически
# Запуск: */5 * * * * /path/to/system-doctor.sh
# Лечит: упавший worker, зависший Next.js, протухший ждун
# Telegram: только если не смог вылечить

PROJECT_DIR="/var/www/www-root/data/www/leads.konversus.ru"
BOT_TOKEN="8924588782:AAGalvqpkASuXy2ZgmtlApk5W1HRxHKnmrg"
ADMIN_CHAT="778784292"
LOG="/var/log/leads-doctor.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }
notify() { curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" -d "chat_id=${ADMIN_CHAT}" -d "text=$1" -d "parse_mode=Markdown" -o /dev/null --max-time 5; }

HEALED=""
FAILED=""
RESTARTED=0

# ─── 1. Лечим Next.js ──────────────────────────────────────────────────

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 http://localhost:3005/ 2>/dev/null)
if [ "$HTTP" != "200" ]; then
  log "🔴 Next.js не отвечает (HTTP $HTTP) — лечу..."
  pm2 restart leads-konversus 2>/dev/null
  sleep 5
  HTTP2=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 http://localhost:3005/ 2>/dev/null)
  if [ "$HTTP2" = "200" ]; then
    HEALED="${HEALED}✅ Next.js: перезапущен (${HTTP} → 200)\n"
    RESTARTED=1
  else
    FAILED="${FAILED}🔴 Next.js: НЕ СМОГ ВЫЛЕЧИТЬ (${HTTP} → ${HTTP2})\n"
  fi
else
  log "✅ Next.js: OK"
fi

# ─── 2. Лечим воркер ──────────────────────────────────────────────────

WORKER_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "
import sys,json
for p in json.load(sys.stdin):
    if p.get('name')=='leads-worker': print(p.get('pm2_env',{}).get('status','?'))
" 2>/dev/null)

if [ "$WORKER_STATUS" != "online" ]; then
  log "🔴 Worker не online (${WORKER_STATUS}) — лечу..."
  pm2 restart leads-worker 2>/dev/null
  sleep 8
  WORKER_STATUS2=$(pm2 jlist 2>/dev/null | python3 -c "
import sys,json
for p in json.load(sys.stdin):
    if p.get('name')=='leads-worker': print(p.get('pm2_env',{}).get('status','?'))
" 2>/dev/null)
  if [ "$WORKER_STATUS2" = "online" ]; then
    HEALED="${HEALED}✅ Worker: перезапущен\n"
    RESTARTED=1
  else
    FAILED="${FAILED}🔴 Worker: НЕ СМОГ ВЫЛЕЧИТЬ\n"
  fi
else
  log "✅ Worker: online"
fi

# ─── 3. Лечим ждуна ──────────────────────────────────────────────────

if [ -f "$PROJECT_DIR/.worker-status.json" ]; then
  MODE=$(grep -o '"mode":"[^"]*"' "$PROJECT_DIR/.worker-status.json" | cut -d'"' -f4)
  LAST_CHECK=$(grep -o '"lastCheckAt":"[^"]*"' "$PROJECT_DIR/.worker-status.json" | cut -d'"' -f4)
  RUNNING=$(grep -o '"running":true' "$PROJECT_DIR/.worker-status.json" | head -1)

  if [ -z "$RUNNING" ]; then
    log "🔴 Worker stopped (running:false) — лечу..."
    pm2 restart leads-worker 2>/dev/null
    HEALED="${HEALED}✅ Worker: перезапущен (был остановлен)\n"
    RESTARTED=1
  elif [ "$MODE" = "watch" ] && [ -n "$LAST_CHECK" ]; then
    LAST_EPOCH=$(date -d "$LAST_CHECK" +%s 2>/dev/null)
    NOW_EPOCH=$(date +%s)
    if [ -n "$LAST_EPOCH" ]; then
      GAP=$(( (NOW_EPOCH - LAST_EPOCH) / 60 ))
      # Не лечим если ночной стоп (00:00-07:00 МСК)
      HOUR_MSK=99
      if [ "" -ge 0 ] && [ "" -lt 7 ]; then
        log "🌙 Ночной стоп — не лечим"
      elif [ "" -gt 15 ]; then
      fi
      if [ "$GAP" -gt 15 ]; then
        log "🟡 Ждун: lastCheckAt ${GAP} мин назад — лечу (рестарт воркера)..."
        pm2 restart leads-worker 2>/dev/null
        HEALED="${HEALED}✅ Ждун: перезапущен (lastCheck ${GAP} мин)\n"
        RESTARTED=1
      else
        log "✅ Ждун: lastCheck ${GAP} мин назад"
      fi
    fi
  elif [ "$MODE" != "watch" ]; then
    log "⚠️ Режим: ${MODE} (не watch)"
  fi
fi

# ─── 4. Проверяем БД ──────────────────────────────────────────────────

DB=$(cd "$PROJECT_DIR" && npx tsx -e "
const {PrismaClient}=require('@prisma/client');
new PrismaClient().\$connect().then(()=>{console.log('OK');process.exit(0)}).catch((e)=>{console.log('ERR');process.exit(1)})
" 2>/dev/null)

if [ "$DB" != "OK" ]; then
  FAILED="${FAILED}🔴 База данных: недоступна\n"
  log "🔴 DB недоступна"
else
  log "✅ DB: доступна"
fi

# ─── 5. Проверяем источники на ошибки ──────────────────────────────────

ERROR_SRC=$(cd "$PROJECT_DIR" && npx tsx -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const sources=await p.source.findMany({where:{enabled:true,status:'error'},select:{id:true,platform:true,lastError:true}});
  if(sources.length>0){console.log(JSON.stringify(sources));process.exit(1)}
  process.exit(0)
})().catch(()=>process.exit(1))
" 2>/dev/null)

SRC_EXIT=$?
if [ "$SRC_EXIT" != "0" ] && [ -n "$ERROR_SRC" ]; then
  # Есть источники с ошибками — сбрасываем статус и перезапускаем воркер
  log "🟡 Источники с ошибками: $ERROR_SRC — сбрасываю статус..."
  cd "$PROJECT_DIR" && npx tsx -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  await p.source.updateMany({where:{enabled:true,status:'error'},data:{status:'active',lastError:'Авто-сброс доктором'}});
  await p.\$disconnect();
})();
" 2>/dev/null
  pm2 restart leads-worker 2>/dev/null
  HEALED="${HEALED}✅ Источники: сброшен статус error → active\n"
  RESTARTED=1
else
  log "✅ Источники: без ошибок"
fi

# ─── Отчёт ────────────────────────────────────────────────────────────

if [ -n "$FAILED" ]; then
  notify "🛑 *Доктор: НЕ ВСЁ ВЫЛЕЧИЛ*
${FAILED}
${HEALED}"
  log "CRITICAL: есть невылеченные проблемы"
elif [ -n "$HEALED" ]; then
  notify "💊 *Доктор: вылечил систему*
${HEALED}"
  log "HEALED: автоматическое лечение применено"
else
  log "✅ Всё в порядке"
fi

tail -500 "$LOG" > "${LOG}.tmp" 2>/dev/null && mv "${LOG}.tmp" "$LOG" 2>/dev/null
