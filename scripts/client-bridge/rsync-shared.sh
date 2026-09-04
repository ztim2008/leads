#!/usr/bin/env bash
# Variant C: rsync built static/PHP tree to shared hosting (Timeweb/Beget).
# Not for Next SSR / PM2 apps — use deploy-to-vps.sh (variant B) or hub hosting (A).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${DEPLOY_ENV_FILE:-$SCRIPT_DIR/deploy.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy deploy.env.example and fill settings." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${SSH_HOST:?}"
: "${SSH_USER:?}"
: "${REMOTE_DIR:?}"
: "${LOCAL_DIR:?}"

SSH_PORT="${SSH_PORT:-22}"
RSYNC_DELETE="${RSYNC_DELETE:-0}"

if [[ ! -d "$LOCAL_DIR" ]]; then
  echo "LOCAL_DIR not found: $LOCAL_DIR" >&2
  exit 1
fi

RSYNC_SSH="ssh -p ${SSH_PORT}"
if [[ -n "${SSH_KEY:-}" ]]; then
  RSYNC_SSH="ssh -p ${SSH_PORT} -i ${SSH_KEY}"
fi

DELETE_FLAG=()
if [[ "$RSYNC_DELETE" == "1" ]]; then
  DELETE_FLAG=(--delete)
fi

echo "==> rsync ${LOCAL_DIR} → ${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}"
rsync -az "${DELETE_FLAG[@]}" \
  -e "$RSYNC_SSH" \
  --exclude .env \
  --exclude node_modules \
  --exclude .git \
  "${LOCAL_DIR%/}/" \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"

echo "==> Done (shared hosting). Verify HTTPS and payment webhook if applicable."
