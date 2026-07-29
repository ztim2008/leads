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

### Refactor: трёхуровневая система стабильности
**Problem:** health-monitor имел хрупкий restart tracking в памяти → ложные алерты. Правки через SSH ломались (bash 0xc0000142).

**Solution:** три независимых уровня защиты:
1. **ecosystem.config.cjs** — все PM2 процессы с политиками: max_restarts, restart_delay, max_memory_restart
2. **/opt/health-check.sh** — внешний bash-скрипт через cron (каждые 5 мин), не зависит от Node.js. Проверяет: PM2 статус, Docker, диск, память. Алерты через curl в Telegram.
3. **health-monitor.ts v2** — чистый, без restart tracking. Только: проверка БД/TG/лидов, пульс партнёрам, heartbeat.

**Files:**
- ecosystem.config.cjs (новый)
- /opt/health-check.sh (новый)
- src/collectors/health-monitor.ts (переписан)

### Clarification: VPS location — Russia works
**Decision:** VPS can be in Russia. Agent sends leads to main server (KZ) via HTTPS, main server sends Telegram from KZ. Russian VPS (~800-1500 RUB/mo) is cheaper than KZ (~2500 RUB/mo). Risk: only if RKN blocks leads.konversus.ru domain (unlikely for small project).

### Decision: VPS per partner (not proxy)
**Why:** 1 IP = 1 partner = full Profi isolation. Partner pays VPS (800-2500 RUB/mo) + subscription (999 RUB/mo). Auto-install: curl | bash in 2 min. Proxies are risky (Profi detects DC IPs, residential proxies cost 3000-5000 RUB/mo per IP).

### Idea (deferred): Self-hosted light version
Partner buys VPS, downloads zip, fills config.json (Profi login/password + Telegram token), runs install.sh. SQLite instead of PostgreSQL. Self-contained. Risks: code theft, no monitoring, single-payment model. Deferred for now.

---

## Итоги дня · 29 июля 2026

### Сделано (12 коммитов)

**Бюджет и фильтры:**
- budget: извлечение из description (extractBudget export + паттерн до)
- filters: keywords/minusKeywords/budget в shared.ts
- titleKeywords/titleMinusKeywords: раздельная фильтрация заголовка и описания

**Стабильность:**
- fix P2003: auth.ts fallback + try-catch в dashboard
- ecosystem.config.cjs: все процессы с max_restarts, restart_delay, memory limits
- cron health-check: /opt/health-check.sh (bash, не зависит от Node)
- health-monitor v3: Telegram policeman (самопроверка, счётчик ошибок)
- profi watcher: авто-реанимация при истечении сессии + 30-мин тишине

**Архитектура партнёров:**
- agent API: POST /api/agent/leads, GET /api/agent/config, POST /api/agent/heartbeat
- agent.mjs: standalone скрипт для VPS партнёра
- setup.sh: автоустановка (curl | bash)
- admin panel: форма + setup-команда + PartnerStatusPanel
- документация: 4 paths, Path E (zero-touch), LOGISTICS, PARTNER-ONBOARDING

**Баги найдены и починены:**
- Фильтры читали Settings.keywords вместо Source.keywords → партнёр без заявок
- health-monitor спамил ложными алертами рестартов (3 раза чинили)
- Python-патчи через SSH не матчили текст (перешли на sed + scp)

### Конфигурация (зафиксирована в памяти)
- saveandnotify-config-pattern
- profi-source-configs
- onboarding-paths
- leads-konversus-setup

### Состояние системы
- Все PM2 процессы online, restarts: 0-4
- DB: 24 MB, 1544 leads
- Telegram: работает
- Profi: ждуны активны, авто-реанимация
- Диск: 85% (нужна очистка)
