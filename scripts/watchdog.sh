#!/bin/bash
# Watchdog — проверяет здоровье системы каждые 10 минут
# Если нет новых заявок > 30 мин или worker упал → Telegram-уведомление

BOT_TOKEN="8924588782:AAGalvqpkASuXyn_g25CPBDjOeWEUYBjEvA"
CHAT_ID="778784292"
API_URL="https://api.telegram.org/bot${BOT_TOKEN}/sendMessage"

# Проверить что PM2 процессы живы
WORKER_STATUS=$(pm2 jlist 2>/dev/null | npx -y json -e 'this.filter(p=>p.name==="leads-worker")[0]?.pm2_env?.status' 2>/dev/null || echo "unknown")

# Проверить время последней заявки через БД
LAST_LEAD=$(cd /var/www/www-root/data/www/leads.konversus.ru && npx tsx -e "
const {db}=require('./src/lib/db');
(async()=>{
  const lead=await db.lead.findFirst({orderBy:{createdAt:'desc'}});
  if(lead) console.log(new Date(lead.createdAt).toISOString());
  else console.log('none');
  process.exit(0);
})()" 2>/dev/null)

# Проверить источник
SOURCE_CHECK=$(cd /var/www/www-root/data/www/leads.konversus.ru && npx tsx -e "
const {db}=require('./src/lib/db');
(async()=>{
  const s=await db.source.findFirst({where:{platform:'profi'}});
  console.log(JSON.stringify({enabled:s?.enabled,lastCheck:s?.lastCheckAt?.toISOString()}));
  process.exit(0);
})()" 2>/dev/null)

# Логика проверок
ALERT=""

if [ "$WORKER_STATUS" != "online" ]; then
  ALERT="🔴 Worker упал! Статус: ${WORKER_STATUS}"
elif [ "$LAST_LEAD" = "none" ]; then
  SOURCE_ENABLED=$(echo "$SOURCE_CHECK" | grep -o '"enabled":[^,}]*' | cut -d: -f2)
  if [ "$SOURCE_ENABLED" = "true" ]; then
    ALERT="⚠️ Worker работает, но заявок нет. Возможно проблема с Profi (логин/пароль?). Проверьте настройки источника."
  fi
else
  # Проверить насколько старая последняя заявка
  LAST_TS=$(date -d "$LAST_LEAD" +%s 2>/dev/null || echo 0)
  NOW_TS=$(date +%s)
  DIFF=$(( (NOW_TS - LAST_TS) / 60 ))
  
  if [ "$DIFF" -gt 60 ]; then
    ALERT="⚠️ Последняя заявка была ${DIFF} мин назад. Возможна проблема со сбором."
  fi
fi

# Отправить уведомление если есть проблема
if [ -n "$ALERT" ]; then
  # Проверить не отправляли ли уже (флаг-файл)
  FLAG="/tmp/leads-alert-sent"
  if [ ! -f "$FLAG" ] || [ $(( $(date +%s) - $(stat -c %Y "$FLAG") )) -gt 1800 ]; then
    curl -s -X POST "$API_URL" \
      -H "Content-Type: application/json" \
      -d "{\"chat_id\":\"$CHAT_ID\",\"text\":\"$ALERT\",\"parse_mode\":\"Markdown\",\"disable_web_page_preview\":true}" \
      -o /dev/null
    touch "$FLAG"
  fi
else
  # Всё хорошо — удалить флаг если был
  rm -f /tmp/leads-alert-sent
fi

echo "$(date): Worker=$WORKER_STATUS LastLead=$LAST_LEAD Alert=$([ -n "$ALERT" ] && echo 'YES' || echo 'no')"
