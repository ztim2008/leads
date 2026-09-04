#!/usr/bin/env bash
# Variant B: deploy Next/Node app from hub to client mini-VPS over SSH.
# Usage:
#   cp scripts/client-bridge/deploy.env.example scripts/client-bridge/deploy.env
#   ./scripts/client-bridge/deploy-to-vps.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${DEPLOY_ENV_FILE:-$SCRIPT_DIR/deploy.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy deploy.env.example and fill SSH/REMOTE settings." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${SSH_HOST:?}"
: "${SSH_USER:?}"
: "${REMOTE_DIR:?}"
: "${PM2_NAME:?}"

SSH_PORT="${SSH_PORT:-22}"
SYNC_MODE="${SYNC_MODE:-git}"
GIT_BRANCH="${GIT_BRANCH:-main}"
REMOTE_INSTALL_CMD="${REMOTE_INSTALL_CMD:-npm ci}"
REMOTE_BUILD_CMD="${REMOTE_BUILD_CMD:-npm run build}"
PM2_RELOAD="${PM2_RELOAD:-1}"
APP_PORT="${APP_PORT:-3010}"

SSH_OPTS=(-p "$SSH_PORT" -o StrictHostKeyChecking=accept-new)
if [[ -n "${SSH_KEY:-}" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi

ssh_cmd() {
  ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "$@"
}

echo "==> Deploy to ${SSH_USER}@${SSH_HOST}:${REMOTE_DIR} (sync=${SYNC_MODE})"

if [[ "$SYNC_MODE" == "rsync" ]]; then
  : "${LOCAL_DIR:?LOCAL_DIR required when SYNC_MODE=rsync}"
  if [[ ! -d "$LOCAL_DIR" ]]; then
    echo "LOCAL_DIR not found: $LOCAL_DIR" >&2
    exit 1
  fi
  RSYNC_SSH="ssh -p ${SSH_PORT}"
  if [[ -n "${SSH_KEY:-}" ]]; then
    RSYNC_SSH="ssh -p ${SSH_PORT} -i ${SSH_KEY}"
  fi
  rsync -az --delete \
    -e "$RSYNC_SSH" \
    --exclude node_modules \
    --exclude .next \
    --exclude .git \
    --exclude .env \
    --exclude deploy.env \
    "${LOCAL_DIR%/}/" \
    "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"
elif [[ "$SYNC_MODE" == "git" ]]; then
  ssh_cmd "set -euo pipefail
    cd '$REMOTE_DIR'
    git fetch --all --prune
    git checkout '$GIT_BRANCH'
    git pull --ff-only origin '$GIT_BRANCH'
  "
else
  echo "Unknown SYNC_MODE=$SYNC_MODE (use git|rsync)" >&2
  exit 1
fi

ssh_cmd "set -euo pipefail
  cd '$REMOTE_DIR'
  if [[ -f package-lock.json ]] || [[ -f npm-shrinkwrap.json ]]; then
    $REMOTE_INSTALL_CMD
  elif [[ -f pnpm-lock.yaml ]]; then
    corepack enable
    pnpm install --frozen-lockfile
  elif [[ -f yarn.lock ]]; then
    yarn install --frozen-lockfile
  else
    npm install
  fi
  $REMOTE_BUILD_CMD
  export PORT='${APP_PORT}'
  if pm2 describe '$PM2_NAME' >/dev/null 2>&1; then
    if [[ '${PM2_RELOAD}' == '1' ]]; then
      pm2 reload '$PM2_NAME' --update-env
    else
      pm2 restart '$PM2_NAME' --update-env
    fi
  else
    pm2 start npm --name '$PM2_NAME' -- start
    pm2 save
  fi
  pm2 show '$PM2_NAME' | head -n 20
"

echo "==> Health check (remote localhost:${APP_PORT})"
code="$(ssh_cmd "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${APP_PORT}/ || true")"
echo "HTTP ${code}"
if [[ "$code" != "200" && "$code" != "301" && "$code" != "302" && "$code" != "307" && "$code" != "308" ]]; then
  echo "Warning: unexpected status from app root: ${code}" >&2
fi

echo "==> Done. Point DNS A-record to VPS IP; webhook: https://<domain>/api/payments/webhook"
