#!/bin/bash
# Leads Agent v2 — установка на VPS партнёра (agent-core + circuit breaker)
# curl -fsSL https://leads.konversus.ru/agent/v2/install.sh | bash -s SOURCE_ID

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "============================================"
echo "  🚀 Leads AI Agent v2 — установка"
echo "============================================"

SOURCE_ID="${1:-}"
API_URL="${API_URL:-https://leads.konversus.ru}"
AGENT_SECRET="${AGENT_SECRET:-leads-agent-secret-2026}"

if [ -z "$SOURCE_ID" ]; then
  echo -e "${RED}❌ Не указан SOURCE_ID${NC}"
  echo "Использование: curl ... | bash -s SOURCE_ID"
  exit 1
fi

echo "SOURCE_ID: $SOURCE_ID"
echo "API: $API_URL"
echo ""

echo "📦 Системные пакеты..."
sudo apt-get update -qq
sudo apt-get install -y -qq curl ca-certificates 2>/dev/null

if ! command -v node &>/dev/null; then
  echo "📦 Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo -e "${GREEN}✅ Node $(node -v)${NC}"

if ! command -v pm2 &>/dev/null; then
  sudo npm install -g pm2
fi
echo -e "${GREEN}✅ PM2${NC}"

AGENT_DIR="/opt/leads-agent-v2"
sudo mkdir -p "$AGENT_DIR"
cd "$AGENT_DIR"

echo "📥 Загрузка agent v2..."
sudo curl -fsSL "$API_URL/agent/v2/agent.bundle.mjs" -o agent.bundle.mjs
sudo curl -fsSL "$API_URL/agent/v2/agent.mjs" -o agent.mjs
sudo chmod +x agent.mjs

cat > .env << EOF
API_URL=$API_URL
AGENT_SECRET=$AGENT_SECRET
SOURCE_ID=$SOURCE_ID
EOF

echo "📦 Playwright + Chromium..."
npm init -y 2>/dev/null
npm install playwright 2>/dev/null
npx playwright install-deps chromium 2>/dev/null || true
npx playwright install chromium 2>/dev/null

# PM2 не читает .env сам — экспортируем в окружение процесса + launcher грузит .env
set -a
# shellcheck disable=SC1091
source "$AGENT_DIR/.env"
set +a

pm2 delete leads-agent-v2 2>/dev/null || true
pm2 start agent.mjs --name leads-agent-v2 --interpreter node \
  --max-restarts 3 --restart-delay 60000
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ Agent v2 запущен (leads-agent-v2)${NC}"
echo "pm2 logs leads-agent-v2"
echo "Heartbeat → $API_URL/api/v2/agent/heartbeat"
