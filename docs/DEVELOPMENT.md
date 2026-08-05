# Дневник разработки

> **Устарело.** Актуальный лог → **[DEVLOG.md](../DEVLOG.md)**.  
> Регламент работы → **[AGENTS.md](../AGENTS.md)**.  
> План → **[docs/PLAN_2026-08-10.md](PLAN_2026-08-10.md)**.

## 2026-06-17 — День 1 (архив)

### Сделано
- ✅ Создан проект leads.konversus.ru (Next.js 16 + TS + Tailwind)
- ✅ Docker Compose: PostgreSQL 16 + Redis 7
- ✅ Prisma-схема: 10 таблиц, multi-tenant через workspaceId
- ✅ NextAuth авторизация (Credentials)
- ✅ Плагинная архитектура коннекторов
- ✅ Страницы: лендинг, /auth, dashboard (обзор/заявки/источники/настройки/аналитика)
- ✅ Profi.ru коннектор через Playwright (логин TimofeyevAG11)
- ✅ AI-анализ через DeepSeek Chat (оценка 0-100)
- ✅ Определение botProbability (робот/человек)
- ✅ Генерация 4 типов откликов
- ✅ Telegram-уведомления (Chat ID: 778784292)
- ✅ Автономный планировщик (каждые 5 мин)
- ✅ Дизайн-система: Inter, Lucide, токены, светлая/тёмная тема
- ✅ Nginx + SSL (ISPmanager)
- ✅ PM2: leads-konversus (id 10) + leads-worker (id 11)
- ✅ Git: 6 коммитов, тег v0.1.0-mvp
- ✅ Документация: README, ROADMAP, ARCHITECTURE, DEVLOG

### Баги/Проблемы
- ⚠️ Redis eviction policy warning (noeviction → исправлен в compose)
- ⚠️ Profi.ru GraphQL требует полной сигнатуры (использован Playwright вместо API)
- ⚠️ OpenRouter ключ пользователя истёк (заменён)

### Следующие шаги
- 🔲 Индикатор статуса системы
- 🔲 Автоудаление старых заявок
- 🔲 Переработка карточек заявок (цена крупно)
- 🔲 Быстрые фильтры
- 🔲 Карточка заявки с откликами

---

## Заметки

### Почему Playwright а не API
Profi.ru использует GraphQL с сигнатурами и CSRF-защитой. Прямые запросы к API возвращают 403/401. Playwright эмулирует браузер → авторизуется как человек → парсит DOM. Работает стабильно.

### Почему DeepSeek а не GPT-4
DeepSeek Chat на OpenRouter стоит ~$0.00001 за анализ. GPT-4o-mini в 14 раз дороже. Для MVP достаточно.

### SaaS-изоляция
Все запросы к БД фильтруются по workspaceId, полученному из сессии пользователя. При регистрации автосоздаётся Workspace + Settings. Подписка лимитирует количество источников и заявок в день.

### Дизайн-система
Токены в CSS-переменных (:root / .dark). Inter 400-800. Lucide иконки. Сетка 0px с border вместо карточек. Тема сохраняется в localStorage.
