# План продолжения · 12 августа 2026

> **Для нового чата с агентом.** Скопируй блок «Контекст для агента» в начало сообщения.

---

## Контекст для агента

```
Проект: leads.konversus.ru (PM2 leads-konversus, порт 3005)
План: docs/PLAN_2026-08-10.md
Онбординг: docs/OPERATOR_AGENT.md + npm run operator:onboard
Политика: profiOnHub: false — Playwright Profi только на VPS партнёра

Сделано 11.08: auth unified, админка (5 вкладок), monthly quota, помощник, operator CLI.
Пилот VPS: leads-pilot-1, IP 159.194.213.198 — install агента ещё НЕ выполнен.
Блокер: новый Profi-аккаунт для пилота (старые мертвы).
```

---

## Цель дня 12.08

**Закрыть DoD этапа 2.8 + начало 4.5–4.6:** agent v2 на `leads-pilot-1` → heartbeat в админке → первая заявка в Telegram → 0 блокировок.

---

## Приоритет 1 — Пилот на VPS (2–3 ч)

| # | Задача | DoD |
|---|--------|-----|
| 1 | Новый Profi-аккаунт (ниша пилота) или тестовый | Логин/пароль в админке |
| 2 | `npm run operator:onboard -- --paste` или форма «+ Подключить» | sourceId + install cmd |
| 3 | SSH `root@159.194.213.198` → `curl install.sh \| bash -s SOURCE_ID` | `pm2 status` → leads-agent-v2 online |
| 4 | Админка → Партнёры: agent **online**, IP сохранён | heartbeat < 15 мин |
| 5 | `npm run operator:verify -- email` | ✅ heartbeat, quota |

---

## Приоритет 2 — Наблюдение (если пилот запущен)

| # | Задача |
|---|--------|
| 6 | 2–4 ч мониторинг: CB не OPEN, нет лавины логинов |
| 7 | Первая заявка в TG партнёра |
| 8 | Записать в DEVLOG метрики (uptime, leads, errors) |

---

## Приоритет 3 — если время останется

| # | Задача | План |
|---|--------|------|
| 9 | Кнопки админки: сброс CB, стоп агента | Этап 3.6 ⚪ |
| 10 | `docs/PARTNER-ONBOARDING.md` под v2 | 4.7 ⚪ |
| 11 | Набросок `docs/PARTNER_TELEGRAM_BOT.md` | 4.8 ⚪ |

**Не начинать:** этап 4.9 (единый TG-бот) до успешного 4.6.

---

## Команды быстрого старта

```bash
cd /var/www/www-root/data/www/leads.konversus.ru
git pull origin main
pm2 status leads-konversus
npm run operator:verify -- partner@email.ru
```

---

## Риски

| Риск | Действие |
|------|----------|
| 2 GB RAM на VPS | Смотреть `pm2 logs`; при OOM — 4 GB |
| Profi SMS/капча при install | CB → стоп, не рестартить вручную |
| Нет Profi-аккаунта | 🔴 блокер — сначала регистрация специалиста |
