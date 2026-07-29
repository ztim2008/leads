# Dev Log — leads.konversus.ru

## 2026-07-29

### Fix: budget from description for Profi
**Problem:** budgetMin = null for most Profi leads — list page hides budget, only available inside description (e.g. «до 10000 RUB»).

**Files:**
- src/lib/connectors/profi.ts — extractBudget exported, added /до/ pattern
- src/collectors/shared.ts — saveAndNotify: if budgetMin missing, extract from lead.description via extractBudget. Format: 10 000 RUB.

### Fix: 338 Next.js restarts (P2003 FK violation)
**Problem:** leads-konversus crashed 338 times in 14h. auth.ts fallback used payload.email as userId for workspace creation — email is not UUID — Prisma FK violation — crash.

**Files:**
- src/lib/auth/auth.ts:81-86 — fallback now looks up real user by email in DB
- src/app/dashboard/page.tsx:13-23 — workspace.create() wrapped in try-catch

### Diagnostics
- Kwork: stable, 94 leads/24h, last today 05:50 MSK
- Profi (TimofeyevAG11): 942 leads total, watcher active, sleeps 22:00-08:00 MSK
- Profi (RysyevVO): 267 leads, 06:00-22:00 MSK
- Telegram API: OK (0.3s)
- All collectors restarted


### Fix: filters keywords/minusKeywords/budget in shared saveAndNotify
**Problem:** profi-watcher sent leads directly to saveAndNotify, bypassing queue. Filters were only in worker.ts.

**Files:** src/collectors/shared.ts — added matchesKeywords(), hasMinusKeywords(), budgetInRange().

### Fix: deepScan enabled for RysyevVO (partner)
**Problem:** disableDeepScan=true — watcher skipped order detail pages, no budget extraction.

**Fix:** DB source 0fd79a72 — disableDeepScan=false.

### Fix: TS implicit any types in filter functions
**Files:** src/collectors/shared.ts — added type annotations for arrow function params.

### TODO
- Monitor/alerter for restarts
- Kwork: budget also missing from list, needs same fix

### Feature: Health Monitor — независимый процесс мониторинга
**Problem:** не было независимого health-check. pulse жил внутри worker.ts. Партнёр не получал регулярный пульс.

**Files:**
- src/collectors/health-monitor.ts — новый PM2 процесс, проверяет каждые 5 мин:
  - PM2 процессы (статус, рестарты)
  - База данных (connectivity)
  - Telegram API (доступность)
  - Лиды (количество за час, время последней)
  - Алерты: частые рестарты (>3/час), тишина (>60 мин без лидов), БД упала, TG упал
  - Пульс партнёрам: каждые 3 часа со статистикой
  - Heartbeat партнёрам: каждый час «система на связи»
- PM2: leads-health (id 11)

### Fix: мониторинг рестартов PM2
**Problem:** частые рестарты оставались незамеченными.
**Fix:** health-monitor отслеживает историю рестартов, алертит при >3 за час.
