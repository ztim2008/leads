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

## 30 июля 2026

### Fix: auto-recovery watcher
**Problem:** watcher died with "Assignment to constant variable". Duplicate const lastNewLead + page reassignment.
**Fix:** stopWatching/startWatching instead of variable reassignment. Stack trace logging added.
**Files:** src/lib/connectors/profi.ts
**Result:** 07:20 found error, 08:00 fixed, 08:05 first leads. Testing auto-recovery today.


---

## Итоги дня · 30 июля 2026

### Инцидент: блокировка Profi
- 07:20: обнаружено — 0 заявок Profi за ночь
- 07:45: причина — 3277 рестартов за час (три механизма рестарта без координации)
- 08:00: фикс v1 (чистая авто-реанимация)
- 09:00: RysyevVO тоже заблокирован (цикл рестартов)
- 09:30: остановлены все коллекторы, cooldown logic

### Созданы документы
- docs/ANTI_BLOCK_PLAN.md — работа над ошибками + план архитектуры v2
- docs/TZ_LEADS_AI_V2.md — полное ТЗ новой системы (388 строк)

### Ключевые решения
- Circuit Breaker: 3 ошибки → стоп 60 мин (persistent, в БД)
- Persistent Profile: куки браузера на диске, переиспользование сессий
- Один координатор состояний агента (вместо трёх механизмов рестарта)
- Деплой через GitHub Actions (не через SSH)
- Ноль блокировок Profi как KPI

### Состояние
- leads-profi: STOPPED (до разблокировки аккаунтов)
- leads-kwork: STOPPED
- leads-health: online
- leads-konversus: online
- Ожидает: agent v2 на VPS (аккаунты Profi не восстанавливаются)

## 2026-08-05

### Phase 0: Стабилизация после блокировки Profi
- `pm2 delete leads-profi` — удалён навсегда (было 3277 рестартов)
- Удалены: worker.ts (1024 LOC), worker-run.ts, pulse.ts, 17 test-profi скриптов
- `src/config/hub.ts` — политика profiOnHub: false
- profi-watcher.ts — guard, не запускается на хабе
- system-doctor.sh, health-check.sh — убраны авто-рестарты Profi
- Админка: обновлены health-check и collector-status
- docs/PHASE0_STABILIZATION.md — отчёт

### Plan: PLAN_2026-08-10.md
- Подробный план к 10 августа: боль, философия, 6 этапов (0–5) со статусами ✅🟡⚪
- AGENTS.md, README.md, ROADMAP.md — ссылки на план для других агентов

### Git & процесс
- Remote: `git@github.com:ztim2008/leads.git`
- AGENTS.md: регламент открытия/закрытия дня, git workflow
- `docs/devlog.md`, `docs/DEVELOPMENT.md` — помечены как архив

---

## Итоги дня · 5 августа 2026

### Сделано
- **Phase 0:** Profi на хабе отключён навсегда (`pm2 delete leads-profi`, guard, hub policy)
- Удалён опасный код: `worker.ts` (1024 LOC), 17 test-скриптов, авто-рестарты в doctor/health-check
- План agent v2: `docs/PLAN_2026-08-10.md` (боль, философия, этапы 0–5)
- Процесс: AGENTS.md с чеклистом закрытия дня, единый DEVLOG.md, GitHub remote

### Проверки
- `npm run build` — OK
- `curl localhost:3005` — 200
- `profi-watcher.ts` — BLOCKED на хабе (exit 0)

### Production
- `leads-konversus` — online
- `leads-health` — online
- `leads-kwork` — stopped
- `leads-profi` — удалён из PM2
- Profi: сбор только через VPS-агент (ещё не развёрнут)

### Git
- Первый push на https://github.com/ztim2008/leads (ветка `main`, 196+ коммитов)
- Коммиты: `e62ab5b` Phase 0 + план, `3623c51` AGENTS SSH
- Тег: `checkpoint/phase0-done`
- `git status` — clean, `origin/main` up to date

### Закрытие дня (финал · 12:16 МСК)
- `npm run build` — OK (повторная проверка)
- `curl localhost:3005` — 200
- `pm2 save` — OK
- Регламент: AGENTS.md (открытие/закрытие дня), единый DEVLOG.md

### Следующий шаг (06.08)
- Этап 1, задача 1.1: создать `packages/agent-core/` — circuit breaker + persistent profile

---

## 2026-08-11

### Этап 1: agent-core
- Создан `src/agent-core/`: CircuitBreaker, ProfileStore, ProfiCollector, human/profiles
- CB: CLOSED → OPEN (3/10min → 60min) → HALF_OPEN → BLOCKED (5 циклов); state на диске
- Profile: `~/.leads-agent/profiles/{sourceId}/` (cookies, state.json, chromium/)
- `profi.ts`: убраны `globalThis.__lastNewLead`, SILENT 30min restart, health/session auto-restart → только STOP
- DoD: `npm run test:agent-core` — 6/6 pass
- Документ: `docs/AGENT_CORE.md`
- План: Этап 1 задачи 1.1–1.9 ✅

### Проверки
- `npm run test:agent-core` — OK
- `npm run build` — OK
- `curl localhost:3005` — 200
- `profiOnHub: false` — без изменений

### Production
- `leads-konversus` / `leads-health` — online
- Profi на хабе — по-прежнему запрещён

### Следующий шаг
- Этап 2: `public/agent/v2` на отдельном VPS (обёртка над agent-core)

---

## 2026-08-11 (продолжение)

### Модель «не SaaS» + Этап 2 (код)
- PLAN: блок «3 роли, подключение только админ»
- `/auth` — только вход; `/api/auth/register` → 403
- Agent v2: `src/agent-core/vps-agent.ts` → `public/agent/v2/agent.bundle.mjs`
- API v2: config, heartbeat (+ CB), leads (фильтры), alert (TG админу)
- `public/agent/v2/install.sh` — PM2 `leads-agent-v2`, max_restarts 3
- v1 `agent.mjs` — deprecated stub
- Setup-команды в админке → v2 install.sh

### Проверки
- `npm run build:agent-v2` + `npm run build` — OK
- `npm run test:agent-core` — 6/6

### Осталось (Этап 2 DoD)
- 2.8: тест на отдельном VPS (не хаб)

### Операторская админка + лимиты + помощник
- Auth: единый `leads_token`, impersonation с возвратом
- Админка: Партнёры / + Подключить / Лимиты / Помощник / Система
- Monthly quota: `leadsPerMonth`, стоп сбора + TG admin + partner
- Помощник: `/dashboard/admin/assistant`, whitelist API, confirm-карточки
- ИИ опционально: `OPENAI_API_KEY` + `OPENAI_MODEL` в `.env`

### Файлы
- `src/lib/billing/quota.ts`, `src/lib/assistant/*`
- `src/components/admin/partners-admin-table.tsx`, `operator-assistant.tsx`
- `src/app/dashboard/admin/{new,billing,system,assistant}/`

### Проверки
- `npm run build` — OK
- `pm2 restart leads-konversus`

### Следующий шаг
- Install agent на leads-pilot-1 + Profi-аккаунт для пилота
- `OPENAI_API_KEY` в `.env` для умного парсинга команд (опционально)

### Operator CLI (агент + валидатор)
- `scripts/operator/` — parse, onboard, verify
- `docs/OPERATOR_AGENT.md` — playbook для Cursor-агентов
- `npm run operator:onboard` / `operator:verify`

### PLAN: этап 4.9
- Единый Telegram-бот партнёра (DoD, 8 подзадач)
- 4.8 ⏸️ → ⚪ (ТЗ/UX без BotFather)

---

## Итоги дня · 11 августа 2026

### Сделано

1. **Auth unified** — один cookie `leads_token`, role + impersonation, middleware, logout API
2. **Админка оператора** — вкладки: Партнёры, + Подключить, Лимиты, Помощник, Система
3. **Monthly quota** — `leadsPerMonth`, счётчик, стоп сбора + TG админу и партнёру при лимите
4. **Помощник оператора** — чат в админке, whitelist API, подтверждение действий, опциональный OpenAI
5. **Operator CLI** — `npm run operator:{parse,onboard,verify}`, валидатор, `docs/OPERATOR_AGENT.md`
6. **Agent v2** — `collectionPaused` при лимите, bundle пересобран
7. **План** — этап 2½ ✅, этап 4.9 (единый TG-бот), `docs/NEXT_SESSION_2026-08-12.md`

### Файлы (ключевые)

- `src/lib/auth/session.ts`, `src/lib/billing/quota.ts`, `src/lib/assistant/*`
- `src/app/dashboard/admin/{layout,new,billing,system,assistant}/`
- `scripts/operator/*`, `docs/OPERATOR_AGENT.md`, `docs/NEXT_SESSION_2026-08-12.md`
- `prisma/schema.prisma` + migration monthly quota
- `docs/PLAN_2026-08-10.md`, `AGENTS.md`, `DEVLOG.md`

### Production

- PM2 `leads-konversus` — online, порт 3005
- `npm run build` — OK
- `curl localhost:3005` — 200
- Profi на хабе — **запрещён** (`profiOnHub: false`)
- `leads-profi` — не запущен

### Не закрыто (перенос на 12.08)

- Этап 2.8 / 4.5: install agent на `leads-pilot-1` (159.194.213.198)
- Этап 4.4 🔴: новый Profi-аккаунт для пилота
- Этап 4.6: 24ч наблюдение без блокировок

### Завтра

См. **`docs/NEXT_SESSION_2026-08-12.md`** — пилот VPS, verify, первая заявка в TG.

---

## 2026-08-13

### Пилот + админ-пульт
- `leads-pilot-1`: agent v2 online, Profi `RysyevIV`, вход ок, 9 заявок, TG партнёра `1600729589` (@leadskonversus_bot)
- Карточка доступа: `GET /api/admin/partners/[id]/secrets`, модалка после создания и кнопка «Доступ»
- Пульт: `/dashboard/admin/ops` (светофоры флота, автообновление 30 с)
- `health-monitor` v5: offline >15 мин + сводка 21:00 МСК только админу; дедуп `login_failed` в `/api/v2/agent/alert`
- Пилотный `leads-agent-v2` **не** рестартили
- PLAN: 4.9 safe-фильтры партнёра уточнены; добавлен **5.8** — админ видит, сколько заявок ушло каждому партнёру в Telegram (пульт + вечерняя сводка, не копии заявок)
- Skill **leads-partner-onboard**: любой агент подключает партнёра (parse → onboard → VPS install → verify → отчёт); PLAN 2½.10

### Файлы
- `src/lib/admin/{guard,access-card}.ts`, `src/components/admin/{partner-access-card,ops-console}.tsx`
- `src/app/dashboard/admin/ops/page.tsx`, `src/app/api/admin/partners/[id]/secrets/route.ts`
- `src/collectors/health-monitor.ts`, `src/app/api/v2/agent/alert/route.ts`, `src/agent-core/vps-agent.ts`

### Production
- `npm run build` + `pm2 restart leads-konversus` + `pm2 restart leads-health`
- `profiOnHub: false`, пилот на VPS без рестарта

### Визуал потока (не n8n)
- Пульт: карта VPS → Agent v2 → Profi → Хаб → Telegram + лента времени/ошибок, данные с `GET /api/admin/partners`
- Дашборд партнёра: «Как работает сбор» + светофор (без IP/CB/паролей)
- Сборщик остаётся agent v2; n8n-сервер не поднимаем
- Файлы: `src/components/admin/collector-flow-map.tsx`, `src/components/admin/ops-console.tsx`, `src/components/dashboard/how-collector-works.tsx`, `src/app/dashboard/page.tsx`
- PLAN 5.9 ✅

### login_failed на пульте — архив, не сейчас
- Было: после утреннего SMS/пароля `_lastError` липнул, хотя вход ок и заявки шли
- Пульт: активная ошибка только если CB OPEN/BLOCKED/HALF_OPEN или свежий fail <15 мин; иначе «Архив … (не сейчас)»
- Heartbeat v2 сбрасывает `source.lastError`, если ошибка уже не активна
- Agent v2 (bundle) чистит lastError после «вход выполнен» / CB CLOSED — на пилоте не рестартили
- Файлы: `src/lib/agent/stale-error.ts`, heartbeat, partners API, ops-console, vps-agent.ts

### Доктор системы
- Пульт: живой вердикт ОК / внимание / зови агента (хаб, БД, TG, PM2, флот, CB, offline в рабочие часы)
- «Вылечить безопасное»: архивные login_failed + рестарт `leads-health` если упал
- Авто каждые 5 мин в health v6 (без рестарта самого себя)
- Запрещено лечить: Profi на хабе, VPS-агент, сброс CB
- API: `GET/POST /api/admin/doctor`
- PLAN 5.10 ✅

### Админ ≠ сборщик
- Вход админа → Пульт; `/dashboard`, заявки, источники, настройки закрыты (кроме impersonation)
- Источники Profi+Kwork у `bilariuss@yandex.ru` выключены, история заявок в БД сохранена
- Вкладка «Система» → «Хаб»: только leads-konversus + leads-health, без рестарта Kwork
- `POST /api/sources/test-profi` → 403 (Playwright на хабе)
- Доктор и health не смотрят источники admin-user
- Свои заявки админу — только онбординг как партнёру
- PLAN 5.11 ✅

### Telegram: ложная тревога доктора
- В `.env` не было `TELEGRAM_BOT_TOKEN` — доктор смотрел только env, заявки шли токеном из БД партнёра
- Доктор теперь проверяет env **или** токен из settings + `getMe`
- В `.env` записан рабочий токен (не в git) + `TELEGRAM_ADMIN_CHAT_ID`; health грузит `.env` сам

### TG-карточка v5 (услуги)
- Парсер ленты на хабе: бюджет «до/от», город, дистант, отклики, «только что»
- Пуш: 🔥 заголовок + чипы + одна кнопка «Открыть на Profi». Без простыни ТЗ и без второй кнопки на тот же URL
- Пилот не рестартили — следующий лид уже в новом шаблоне
- Файлы: `src/lib/leads/parse-feed-card.ts`, `src/lib/telegram/notifications.ts`, `src/collectors/shared.ts`
- PLAN 5.12 ✅

---

## Итоги дня · 13 августа 2026

### Сделано
- Пилот **RysyevIV** на VPS `159.194.213.198`: agent v2 online, CB `CLOSED`, вход ок, **13 заявок** за день, TG партнёра `1600729589`
- Админ-пульт `/dashboard/admin/ops`: флот, карта потока, архив stale `login_failed`
- Доктор системы: вердикт + безопасное лечение (не Profi / не VPS / не CB)
- Админ ≠ сборщик: редирект на Пульт, источники admin выкл, `test-profi` 403
- TG-карточка **v5** на хабе: бюджет/город/отклики из текста ленты, одна кнопка; без deep scan
- Токен бота в `.env` (не в git) — доктор больше не врёт «Telegram не отвечает»
- Продуктовое решение: **одна труба, две вертикали** — пилот = сайты, рынок = услуги (ремонт/стройка). Шаблоны разные, коллектор один. Сегодня не кодили вертикаль `sites`
- Наблюдение объёма: 13 для сайтов на Profi — норма; ускорять скан **нельзя**; расширять keywords — только если завтра к обеду живых <3–4

### Файлы
- Пульт/доктор: `src/lib/admin/*`, `src/components/admin/{ops-console,collector-flow-map,system-doctor,hub-status,partner-access-card}*`, `src/app/dashboard/admin/ops/`, `src/app/api/admin/doctor/`
- TG v5: `src/lib/leads/parse-feed-card.ts`, `src/lib/telegram/notifications.ts`, `src/collectors/shared.ts`, `src/app/api/agent/leads/route.ts`
- Health/heartbeat: `src/collectors/health-monitor.ts`, `src/app/api/v2/agent/{heartbeat,alert}/route.ts`, `src/lib/telegram/bot-token.ts`, `src/lib/agent/stale-error.ts`
- Онбординг: `.cursor/skills/leads-partner-onboard/`, `scripts/operator/*`
- План завтра: `docs/NEXT_SESSION_2026-08-14.md`

### Production
- `leads-konversus` online, `localhost:3005` → **200**
- `leads-health` online
- `profiOnHub: false`, `leads-profi` не запущен
- Пилот `leads-agent-v2` **не** рестартили (v5 подхватится на следующем лиде без рестарта)
- Часы пилота 08:00–22:00 МСК → ночь тишина до 08:00 — это норма

### Осталось / завтра
См. **`docs/NEXT_SESSION_2026-08-14.md`**: дожать 4.6 (утро после сна), не трогать интервал Profi, при необходимости только keywords; затем 5.8 (БД vs TG на пульте). 4.9 бот — после 4.6.

---

## 2026-08-14

### TG-карточка v5.1 + доставка 5.8
- В Telegram возвращена суть задачи из уже собранной карточки ленты; добавлены имя, отзывы/новичок и мягкий риск-флаг без deep scan
- TG-карточка стала длиннее (до 900 знаков): бюджет, город, отклик, время и части ТЗ идут отдельными строками без нагромождения
- Парсер понимает варианты «стоимость отклика / отклик за N ₽ / N ₽ за отклик»; в 40 live-payload пилота цена отсутствует, поэтому карточка честно пишет «не показана в ленте»
- Успешные доставки и попытки пишутся в `activity_log`; первая доставка за день сообщает админу один раз
- Пульт показывает БД / подтверждённые TG-доставки и предупреждает только о реальном расхождении попытка→доставка
- Вечерняя сводка показывает по каждому партнёру БД / TG; первый день честно помечается как частичный учёт
- Deploy: `leads-konversus` и `leads-health` перезапущены, `localhost:3005` → 200; пилотный `leads-agent-v2` не рестартовали
- Проверки: `npm run test:agent-core` — 23/23; `npm run build` — успешно

### Наблюдение 4.6
- **4.6 ✅** 18:44 МСК: 24.6 ч от первой заявки, CB CLOSED, failCount 0, heartbeat 2 мин, lastError нет
- Всего 41 заявка (сегодня 28), ночь 22–08 = 0 (сон), после 18:08 ещё 2 шт.
- TG-учёт с 15:09: **10 попыток / 10 доставок**
- Пилот `leads-agent-v2` не рестартили

### Фильтры партнёра — кабинет (4.10)
- Вход: email + пароль из карточки доступа → «Фильтры»
- Поля: ключевые / минус, часы 08–22, бюджет от–до, «без бюджета», пол по имени
- Пол: словарь имён (Анна/Денис); Саша, Женя, «Князь» и пустое имя при М/Ж не проходят
- Применение на хабе без рестарта `leads-agent-v2`

### Этап 4.11 — записан в план
- Дневная выработка на Пульте: сегодня / вчера / TG / последняя заявка; «сброс» = полночь МСК без wipe БД
- Фаза 2: safe-счётчики отсева с agent v2 (после обкатки 4.10), без рестарта входа
- **4.11.1–2 ✅**: API и Пульт показывают сегодня / вчера / TG / последнюю заявку, разницу к вчера и ориентир 8–15
- Live после deploy: пилот **29 сегодня / 13 вчера / 11 TG**, последняя «Создать сайт»
- `npm run test:agent-core` 31/31, `npm run build`, restart только `leads-konversus`, HTTP 200

### Ложный offline RysyevVO
- Причина: старый источник Насти `RysyevVO` оставался `enabled=true`, хотя agent v2 для него никогда не устанавливался
- Источник отключён и архивирован: `enabled=false`, `status=archived`, причина `legacy_account_no_agent_v2`
- Пилот `RysyevIV` не затронут; доктор после исправления: **OK — «Всё работает»**

### AI-токены → план этап 6 (после фильтров)
- Аудит: OpenAI на хабе не настроен; 2 OpenRouter-ключа; 637 анализов + 1433 отклика в БД
- Сократить: 4×-отклики, длинный анализ, LLM-помощник без лимита, AI на каждую заявку
- Усилить: антифейк, 1 персональный отклик по кнопке, usage-лог, дневной budget-stop
- Решение: **не кодить сейчас** — сначала фильтры, потом этап 6 (`docs/PLAN_2026-08-10.md`)

---

## Итоги дня · 14 августа 2026

### Сделано
- TG-карточка **v5.1**: суть задачи (~900 знаков), автор, отзывы/новичок, риск-хинт; цена отклика — «не показана в ленте» без deep scan
- **5.8 ✅** учёт доставки в TG (`activity_log` + Пульт БД/TG + вечерняя сводка + первая доставка админу)
- **4.6 ✅** наблюдение 24.6 ч: CB CLOSED, сон 22–08 = 0, пилот не рестартили
- **4.10 🟡** фильтры партнёра в кабинете (слова / минус / часы / бюджет / без бюджета / пол по имени) — хаб без рестарта VPS
- **4.11.1–2 ✅** выработка дня на Пульте (сегодня / вчера / TG / последняя)
- Ложный offline **RysyevVO** (legacy без agent v2) — архивирован; пилот RysyevIV не тронут
- Этап **6 AI** — аудит записан, код **не** трогали (после обкатки фильтров)

### Файлы
- `src/lib/telegram/delivery.ts`, `notifications.ts`, `health-monitor.ts`
- `src/lib/leads/parse-feed-card.ts`, `partner-filters.ts`, `name-gender.ts`
- `src/components/dashboard/partner-filters-form.tsx`, `ops-console.tsx`
- `src/app/api/admin/partners/route.ts`, `api/settings`, `api/agent/leads`
- `docs/PLAN_2026-08-10.md`, `DEVLOG.md`, `docs/NEXT_SESSION_2026-08-15.md`

### Production (закрытие ~19:25 МСК)
- `npm run build` ✅ · `localhost:3005` → **200**
- PM2: `leads-konversus` / `leads-health` **online**; `leads-profi` нет
- Пилот RysyevIV: HB ~2 мин, CB **CLOSED**, lastError нет
- За день: **29** заявок в БД / **11** подтверждённых TG (учёт с ~15:09)
- `profiOnHub: false` соблюдён; пилот `leads-agent-v2` **не** рестартили

### Осталось / завтра
См. **`docs/NEXT_SESSION_2026-08-15.md`**: обкатать фильтры 4.10; при зелёном — опционально 4.11.3; **не** начинать этап 6 AI и 4.9 бот без команды.
