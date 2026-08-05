# Phase 0 — Стабилизация (05.08.2026)

> Цель: навсегда остановить центральный сбор Profi на хабе и убрать код, который привёл к блокировке аккаунтов 30.07.2026.

---

## Что сделано

### 1. Profi на хабе отключён

| Действие | Результат |
|----------|-----------|
| `pm2 delete leads-profi` | Процесс удалён из PM2 (было 3277 рестартов) |
| `pm2 save` | Сохранено — после ребута не поднимется |
| `ecosystem.config.cjs` | Блок `leads-profi` удалён |
| `src/config/hub.ts` | Политика `profiOnHub: false` |
| `src/collectors/profi-watcher.ts` | Guard: при запуске сразу exit(0) с сообщением |

**Правило:** Playwright для Profi на сервере `109.196.165.106` **запрещён** до миграции на agent v2.

### 2. Удалён мёртвый и опасный код

| Удалено | Размер / причина |
|---------|------------------|
| `src/lib/queue/worker.ts` | 1024 строки — монолит, syntax error, не в PM2 |
| `scripts/worker-run.ts` | Entrypoint мёртвого воркера |
| `src/lib/notifications/pulse.ts` | Только использовался worker.ts |
| `tsconfig.worker.json` | Конфиг для worker |
| `.worker-status.json` | Устаревший статус (Jul 27) |
| `scripts/test-profi-*.ts` (17 файлов) | Эксперименты |
| `scripts/setup-profi-session.ts` | Тестовый скрипт |
| `scripts/test-connector.ts` | Тестовый скрипт |
| `status-indicator.tsx.bak` | Бэкап |

**Сохранено для Phase 1:**
- `src/lib/connectors/profi.ts` — вынесется в agent-core
- `src/collectors/profi-watcher.ts` — с guard, не запускается
- `public/agent/agent.mjs` + `setup.sh` — VPS-агент

### 3. Убраны авто-рестарты Profi

Скрипты, которые **раньше перезапускали leads-profi** (причина 3277 входов):

| Файл | Было | Стало |
|------|------|-------|
| `scripts/system-doctor.sh` | `pm2 restart leads-profi` при любой проблеме | Только Next.js + DB, Profi не трогает |
| `scripts/health-check.sh` | Алерт «воркер не запущен» | Проверяет Next.js + health, Profi = отключён по политике |
| `scripts/watchdog.sh` | Рестарт leads-worker | Deprecated stub |
| `api/admin/health-check` POST | `restart-worker`, `restart-all` | Возвращает 400 с объяснением |
| `api/worker` POST | `pm2 start/stop leads-worker` | Возвращает 400 |

### 4. Обновлена админка

- `health-check-widget.tsx` — статус «Profi на хабе отключён», кнопки Kwork/Health/Next.js
- `collector-status.tsx` — отдельная карточка Profi «VPS-агент»
- `admin/page.tsx` — исправлен сломанный порядок import

---

## Текущее состояние PM2

```
leads-konversus  → online (Next.js :3005)
leads-health     → online (мониторинг)
leads-kwork      → stopped (можно включить отдельно)
leads-profi      → УДАЛЁН
```

---

## Почему аккаунты не восстановить

Profi после инцидента 30.07.2026 заблокировал аккаунты **навсегда** (не временная блокировка). Причина — 3277 попыток входа за час из-за трёх некоординированных механизмов рестарта в `profi.ts`.

**Урок:** один аккаунт Profi = годы репутации. Потеря необратима. Следующий запуск — только через:
1. Новый аккаунт Profi (новый специалист)
2. Отдельный VPS (свой IP)
3. Agent v2 с circuit breaker и persistent profile

---

## Что НЕ делать

```
❌ pm2 start leads-profi
❌ pm2 start src/collectors/profi-watcher.ts
❌ Запускать Playwright для Profi на хабе
❌ Восстанавливать worker.ts
❌ Авто-рестарт при ошибке входа в Profi
```

---

## Следующий шаг (Phase 1)

1. `packages/agent-core` — circuit breaker + persistent profile + единый координатор
2. Agent v2 на VPS партнёра
3. Хаб принимает leads через `/api/agent/leads` — без Playwright

---

*Отчёт: 05.08.2026 · Phase 0 complete*
