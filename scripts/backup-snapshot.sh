#!/usr/bin/env bash
# Слепок хаба leads.konversus.ru: код (git bundle) + БД leads_ai + .env.
# Не кладём в GitHub. Не рестартит VPS-агент и не трогает Profi.
# Cron (страховка, если день не закрыли): 10 3 * * *
# Закрытие дня: npm run snapshot
set -euo pipefail

ROOT="/var/www/www-root/data/www/leads.konversus.ru"
OUT="/var/www/www-root/data/www/_backups/leads"
DAILY="$OUT/daily"
DAYCLOSE="$OUT/dayclose"
WEEKLY="$OUT/weekly"
LOG="$OUT/snapshot.log"
KEEP_DAILY=14
KEEP_DAYCLOSE=56
KEEP_WEEKLY=8
STAMP="$(date +%Y-%m-%d_%H-%M)"
DAY="$(date +%Y-%m-%d)"
NAME="leads-$STAMP"
REASON="${1:-cron}"
WORK="$(mktemp -d /tmp/leads-snap.XXXXXX)"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

mkdir -p "$DAILY" "$DAYCLOSE" "$WEEKLY"
chmod 700 "$OUT" "$DAILY" "$DAYCLOSE" "$WEEKLY"
touch "$LOG"
chmod 600 "$LOG"

cd "$ROOT"

SHA="$(git rev-parse --short HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
{
  echo "date=$DAY"
  echo "stamp=$STAMP"
  echo "reason=$REASON"
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
ln -sfn "$ARCHIVE" "$OUT/latest.tar.gz"

if [[ "$REASON" == "day-close" ]]; then
  cp -a "$ARCHIVE" "$DAYCLOSE/leads-$DAY.tar.gz"
  chmod 600 "$DAYCLOSE/leads-$DAY.tar.gz"
fi

if [[ "$(date +%u)" == "7" ]]; then
  cp -a "$ARCHIVE" "$WEEKLY/leads-$DAY.tar.gz"
  chmod 600 "$WEEKLY/leads-$DAY.tar.gz"
fi

find "$DAILY" -name 'leads-*.tar.gz' -mtime +"$KEEP_DAILY" -delete
find "$DAYCLOSE" -name 'leads-*.tar.gz' -mtime +"$KEEP_DAYCLOSE" -delete
find "$WEEKLY" -name 'leads-*.tar.gz' -mtime +"$((KEEP_WEEKLY * 7))" -delete

SIZE="$(du -h "$ARCHIVE" | cut -f1)"
log "ok reason=$REASON $ARCHIVE ($SIZE) git=$SHA"
echo "$ARCHIVE"
