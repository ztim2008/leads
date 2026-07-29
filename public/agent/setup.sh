#!/bin/bash
# Установщик Leads Agent на VPS партнёра
# Запуск одной командой:
# curl -fsSL https://leads.konversus.ru/agent/setup.sh | bash -s SOURCE_ID

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "============================================"
echo "  🚀 Leads AI Agent — установка"
echo "============================================"
echo ""

SOURCE_ID="${1:-}"
API_URL="${API_URL:-https://leads.konversus.ru}"
AGENT_SECRET="${AGENT_SECRET:-leads-agent-secret-2026}"

if [ -z "$SOURCE_ID" ]; then
    echo -e "${RED}❌ Ошибка: не указан SOURCE_ID${NC}"
    echo "Использование: curl ... | bash -s SOURCE_ID"
    echo "SOURCE_ID можно найти в админке → Источники"
    exit 1
fi

echo "SOURCE_ID: $SOURCE_ID"
echo "API: $API_URL"
echo ""

# ─── Система ────────────────────────────────────
echo "📦 Установка зависимостей..."
sudo apt-get update -qq
sudo apt-get install -y -qq curl wget ca-certificates 2>/dev/null

# ─── Node.js 22 ─────────────────────────────────
if ! command -v node &>/dev/null; then
    echo "📦 Установка Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo -e "${GREEN}✅ Node.js $(node -v)${NC}"

# ─── PM2 ────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
    echo "📦 Установка PM2..."
    sudo npm install -g pm2
fi
echo -e "${GREEN}✅ PM2 установлен${NC}"

# ─── Каталог агента ─────────────────────────────
AGENT_DIR="/opt/leads-agent"
sudo mkdir -p "$AGENT_DIR"
cd "$AGENT_DIR"

# ─── Агент ──────────────────────────────────────
echo "📥 Загрузка агента..."
sudo curl -fsSL "$API_URL/agent/agent.mjs" -o agent.mjs
sudo chmod +x agent.mjs

# ─── Переменные окружения ───────────────────────
cat > .env << EOF
API_URL=$API_URL
AGENT_SECRET=$AGENT_SECRET
SOURCE_ID=$SOURCE_ID
EOF

# ─── Playwright ─────────────────────────────────
echo "📦 Установка Playwright + Chromium..."
npm init -y 2>/dev/null
npm install playwright 2>/dev/null
npx playwright install chromium 2>/dev/null

# ─── PM2 запуск ─────────────────────────────────
pm2 delete leads-agent 2>/dev/null || true
pm2 start agent.mjs --name leads-agent --interpreter node
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo ""
echo "============================================"
echo -e "  ${GREEN}✅ Агент установлен и запущен!${NC}"
echo "============================================"
echo ""
echo "📊 Статус: pm2 status"
echo "📋 Логи:   pm2 logs leads-agent"
echo "🔄 Рестарт: pm2 restart leads-agent"
echo ""
echo "Заявки отправляются на: $API_URL/api/agent/leads"
echo "Heartbeat каждые 5 мин на: $API_URL/api/agent/heartbeat"
