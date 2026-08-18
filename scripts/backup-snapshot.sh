#!/usr/bin/env bash
# Слепок хаба leads.konversus.ru: код (git bundle) + БД leads_ai + .env.
# Не кладём в GitHub. Не рестартит VPS-агент и не трогает Profi.
# Cron: 10 3 * * * /var/www/www-root/data/www/leads.konversus.ru/scripts/backup-snapshot.sh
set -euo pipefail

ROOT="/var/www/www-root/data/www/leads.konversus.ru"
OUT="/var/www/www-root/data/www/_backups/leads"
DAILY="$OUT/daily"
WEEKLY="$OUT/weekly"
LOG="$OUT/snapshot.log"
KEEP_DAILY=14
KEEP_WEEKLY=8
STAMP="$(date +%Y-%m-%d)"
NAME="leads-$STAMP"
WORK="$(mktemp -d /tmp/leads-snap.XXXXXX)"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

mkdir -p "$DAILY" "$WEEKLY"
chmod 700 "$OUT" "$DAILY" "$WEEKLY"
touch "$LOG"
chmod 600 "$LOG"

cd "$ROOT"

SHA="$(git rev-parse --short HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
{
  echo "date=$STAMP"
  echo "host=$(hostname)"
  echo "git=$SHA"
  echo "branch=$BRANCH"
  echo "tags=$(git tag --points-at HEAD | tr '\n' ' ')"
  echo "profiOnHub=false"
  echo "pm2=$(pm2 jlist 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); print(",".join("%s:%s"%(p.get("name"), (p.get("pm2_env") or {}).get("status")) for p in d if str(p.get("name","")).startswith("leads-")))' 2>/dev/null || echo n/a)"
} > "$WORK/meta.txt"

git bundle create "$WORK/code.bundle" --all >/dev/null
docker exec leads-pg pg_dump -U leads_user -d leads_ai --no-owner | gzip -9 > "$WORK/leads_ai.sql.gz"
if [[ -f "$ROOT/.env" ]]; then
  cp -a "$ROOT/.env" "$WORK/env"
  chmod 600 "$WORK/env"
fi

ARCHIVE="$DAILY/$NAME.tar.gz"
tar -C "$WORK" -czf "$ARCHIVE" meta.txt code.bundle leads_ai.sql.gz env
chmod 600 "$ARCHIVE"

# Воскресенье — недельная копия. Первый запуск тоже кладём в weekly.
if [[ "$(date +%u)" == "7" ]] || [[ -z "$(ls -A "$WEEKLY" 2>/dev/null || true)" ]]; then
  cp -a "$ARCHIVE" "$WEEKLY/$NAME.tar.gz"
  chmod 600 "$WEEKLY/$NAME.tar.gz"
fi

find "$DAILY" -name 'leads-*.tar.gz' -mtime +"$KEEP_DAILY" -delete
find "$WEEKLY" -name 'leads-*.tar.gz' -mtime +"$((KEEP_WEEKLY * 7))" -delete

SIZE="$(du -h "$ARCHIVE" | cut -f1)"
log "ok $ARCHIVE ($SIZE) git=$SHA"
echo "$ARCHIVE"
