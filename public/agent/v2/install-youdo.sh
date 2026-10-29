#!/bin/bash
# Leads YouDo agent — установка рядом с Profi-агентом (без входа в аккаунт YouDo)
# curl -fsSL https://leads.konversus.ru/agent/v2/install-youdo.sh | bash -s YOUDO_SOURCE_ID
# Profi-агент (leads-agent-v2) не трогает.

set -e

SOURCE_ID="${1:-}"
API_URL="${API_URL:-https://leads.konversus.ru}"
AGENT_SECRET="${AGENT_SECRET:-leads-agent-secret-2026}"

if [ -z "$SOURCE_ID" ]; then
  echo "❌ Не указан SOURCE_ID источника YouDo"
  exit 1
fi

command -v node >/dev/null || { echo "❌ Нет Node.js — сначала install.sh (Profi-агент)"; exit 1; }
command -v pm2 >/dev/null || sudo npm install -g pm2

AGENT_DIR="/opt/leads-agent-youdo"
sudo mkdir -p "$AGENT_DIR"
cd "$AGENT_DIR"

sudo curl -fsSL "$API_URL/agent/v2/youdo.bundle.mjs" -o youdo.bundle.mjs
sudo curl -fsSL "$API_URL/agent/v2/agent.mjs" -o agent.mjs
sed -i 's#./agent.bundle.mjs#./youdo.bundle.mjs#' agent.mjs

cat > .env << EOF
API_URL=$API_URL
AGENT_SECRET=$AGENT_SECRET
SOURCE_ID=$SOURCE_ID
EOF

if [ ! -d node_modules/playwright ]; then
  npm init -y >/dev/null 2>&1
  npm install playwright >/dev/null 2>&1
  npx playwright install chromium >/dev/null 2>&1
fi

set -a
# shellcheck disable=SC1091
source "$AGENT_DIR/.env"
set +a

pm2 delete leads-agent-youdo 2>/dev/null || true
pm2 start agent.mjs --name leads-agent-youdo --interpreter node \
  --max-restarts 3 --restart-delay 60000
pm2 save

echo "✅ leads-agent-youdo запущен · pm2 logs leads-agent-youdo"
