#!/bin/bash
# Health Check для leads.konversus.ru v2 — понятные сообщения
# Проверяет: Next.js, воркер, БД, сбор заявок
# Telegram: только реальные проблемы, без ложных тревог

TELEGRAM_BOT_TOKEN="8924588782:AAGalvqpkASuXy2ZgmtlApk5W1HRxHKnmrg"
ADMIN_CHAT_ID="778784292"
PROJECT_DIR="/var/www/www-root/data/www/leads.konversus.ru"
LOG_FILE="/var/log/leads-health.log"
TIMEOUT=10

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

notify() {
  local message="$1"
  curl -s -o /dev/null -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --max-time 8 \
    -d "chat_id=${ADMIN_CHAT_ID}" \
    -d "text=${message}" \
    -d "parse_mode=Markdown" \
    -d "disable_web_page_preview=true"
}

# ─── Собираем статус ──────────────────────────────────────────────────────

OK_LINES=""
PROBLEM_LINES=""
ISSUE_COUNT=0
TOTAL_DB_LEADS="?"
TODAY_LEADS="?"
WORKER_REASON="?"
WORKER_GAP="?"
SOURCE_STATUSES=""
MAX_GAP_FOR_INFO=45  # минут, после которых считаем что что-то не так

# 1. Next.js сервер
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT http://localhost:3005/ 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
  OK_LINES="${OK_LINES}✅ Сервер: отвечает 200\n"
else
  ISSUE_COUNT=$((ISSUE_COUNT+1))
  PROBLEM_LINES="${PROBLEM_LINES}🔴 Сервер: НЕ ОТВЕЧАЕТ (HTTP $HTTP_CODE)\n"
  log "ERROR: Server HTTP $HTTP_CODE"
fi

# 2. PM2: Next.js + Health (leads-profi удалён — Phase 0)
NEXTJS_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
procs = json.load(sys.stdin)
for p in procs:
    if p.get('name') == 'leads-konversus':
        print(p.get('pm2_env',{}).get('status','unknown'))
" 2>/dev/null)

HEALTH_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
procs = json.load(sys.stdin)
for p in procs:
    if p.get('name') == 'leads-health':
        print(p.get('pm2_env',{}).get('status','unknown'))
" 2>/dev/null)

NEXTJS_ONLINE=$(echo "$NEXTJS_STATUS" | head -1)

if [ "$NEXTJS_ONLINE" = "online" ]; then
  OK_LINES="${OK_LINES}✅ Next.js: запущен\n"
else
  ISSUE_COUNT=$((ISSUE_COUNT+1))
  PROBLEM_LINES="${PROBLEM_LINES}🔴 Next.js: НЕ ЗАПУЩЕН\n"
fi

if [ "$HEALTH_STATUS" = "online" ]; then
  OK_LINES="${OK_LINES}✅ Health monitor: запущен\n"
else
  PROBLEM_LINES="${PROBLEM_LINES}⚠️ Health monitor: не online\n"
fi

OK_LINES="${OK_LINES}🛡 Profi на хабе: отключён (VPS-агенты)\n"

# 4. База данных
DB_CHECK=$(cd "$PROJECT_DIR" && npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async() => {
  try {
    const leads = await p.lead.count();
    const today = new Date(); today.setHours(0,0,0,0);
    const todayLeads = await p.lead.count({ where: { createdAt: { gte: today } } });
    const sources = await p.source.findMany({ select: { platform:true, status:true, lastError:true, enabled:true } });
    const errSources = sources.filter(s => s.status === 'error' && s.enabled);
    const errInfo = errSources.map(s => s.platform + ':' + (s.lastError||'?').slice(0,60)).join(' | ');
    console.log('OK:' + leads + ':' + todayLeads + ':' + errInfo);
  } catch(e) { console.log('ERR:' + e.message); }
  await p.\$disconnect();
})();
" 2>/dev/null)

if echo "$DB_CHECK" | grep -q "^OK:"; then
  TOTAL_DB_LEADS=$(echo "$DB_CHECK" | cut -d: -f2)
  TODAY_LEADS=$(echo "$DB_CHECK" | cut -d: -f3)
  ERR_SOURCE_INFO=$(echo "$DB_CHECK" | cut -d: -f4-)

  OK_LINES="${OK_LINES}📥 За сегодня: ${TODAY_LEADS} заявок\n"

  if [ -n "$ERR_SOURCE_INFO" ]; then
    ISSUE_COUNT=$((ISSUE_COUNT+1))
    PROBLEM_LINES="${PROBLEM_LINES}🔴 Источники с ошибками:\n   ${ERR_SOURCE_INFO}\n"
  fi
else
  ISSUE_COUNT=$((ISSUE_COUNT+1))
  PROBLEM_LINES="${PROBLEM_LINES}🔴 База данных: ОШИБКА ПОДКЛЮЧЕНИЯ\n"
fi

# ─── Формируем итоговое сообщение ────────────────────────────────────────

if [ "$ISSUE_COUNT" -gt 0 ]; then
  # Есть проблемы
  MSG="🔴 *Система НЕ РАБОТАЕТ* (${ISSUE_COUNT} проблем)
    
${PROBLEM_LINES}"

  # Добавляем что работает (для контекста)
  if [ -n "$OK_LINES" ]; then
    MSG="${MSG}
✅ *Что работает:*
${OK_LINES}"
  fi

  # Добавляем подсказку
  MSG="${MSG}
🛠 *Что делать:*
Проверьте админку → https://leads.konversus.ru/dashboard/admin"

  notify "$MSG"
  log "CRITICAL: $ISSUE_COUNT issues - admin notified"

elif [ -n "$PROBLEM_LINES" ]; then
  # Предупреждения (не критические)
  MSG="🟡 *Система работает*
    
⚠️ *Заметки:*
${PROBLEM_LINES}"

  if [ -n "$OK_LINES" ]; then
    MSG="${MSG}
✅ *Статус:*
${OK_LINES}"
  fi

  WORKER_MODE=$(grep -o '"mode":"[^"]*"' "$PROJECT_DIR/.collector-status.json" 2>/dev/null | head -1 | cut -d'"' -f4)
WORKER_REASON=$(grep -o '"statusReason":"[^"]*"' "$PROJECT_DIR/.collector-status.json" 2>/dev/null | head -1 | cut -d'"' -f4)
if [ "$WORKER_MODE" = "watch" ]; then
  MSG="${MSG}
👀 Режим: ждун · ${WORKER_REASON:-слежу за заказами}"
else
  MSG="${MSG}
🔄 Режим: циклический опрос · ${WORKER_REASON:-1-25 мин}"
fi

  notify "$MSG"
  log "WARN: Non-critical warnings"

else
  # Всё хорошо — пишем в лог, но НЕ шлём в Telegram каждый раз
  log "OK: All checks passed (today: $TODAY_LEADS leads, ${WORKER_GAP:-?}, reason: $WORKER_REASON)"
  # Шлём раз в 2 часа (каждую 12-ю проверку) для успокоения
  COUNTER_FILE="/tmp/leads-health-ok-counter"
  if [ ! -f "$COUNTER_FILE" ]; then
    echo "1" > "$COUNTER_FILE"
  else
    COUNT=$(cat "$COUNTER_FILE")
    COUNT=$((COUNT+1))
    echo "$COUNT" > "$COUNTER_FILE"
    if [ "$COUNT" -ge 12 ]; then
      MSG="🟢 *Система работает стабильно* ✅

${OK_LINES}
📊 Всего в БД: ${TOTAL_DB_LEADS} заявок
⏱ Воркер: ${WORKER_REASON:-активен} (последний сбор ${WORKER_GAP:-?})"
      notify "$MSG"
      echo "0" > "$COUNTER_FILE"
    fi
  fi
fi

# Ротация лога
tail -1000 "$LOG_FILE" > "${LOG_FILE}.tmp" 2>/dev/null && mv "${LOG_FILE}.tmp" "$LOG_FILE" 2>/dev/null
