# Konversus Leads AI

Автоматический поиск и AI-анализ заказов с фриланс-площадок для веб-разработчиков и агентств.

## Суть

Не искать заказы вручную на десятках площадок, а получать только подходящие заявки с AI-оценкой в Telegram и веб-панели.

## Ключевая цепочка

```
Источник (Profi/Avito/FL/Kwork) → Парсер → AI-анализ → Фильтр → Сохранение → Telegram + Панель
```

## Технический стек

| Слой | Технология |
|------|-----------|
| Фреймворк | Next.js 16 (App Router) |
| Язык | TypeScript |
| Стили | Tailwind CSS 4 + Дизайн-токены |
| Иконки | Lucide (локально) |
| Шрифт | Inter (Google Fonts через next/font) |
| База данных | PostgreSQL 16 |
| ORM | Prisma 5 |
| Кеш/очереди | Redis 7 + BullMQ |
| AI | OpenRouter → DeepSeek Chat |
| Браузер | Playwright (для Profi.ru) |
| Telegram | Bot API |
| Деплой | PM2 + Nginx + Docker Compose |
| Хостинг | VPS (109.196.165.106) |

## Архитектура

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Лендинг
│   ├── auth/               # Вход
│   ├── dashboard/          # Панель управления
│   │   ├── page.tsx        # Обзор
│   │   ├── leads/          # Заявки
│   │   ├── sources/        # Источники
│   │   ├── settings/       # Настройки
│   │   └── analytics/      # Аналитика
│   └── api/                # API-эндпоинты
│       ├── auth/           # NextAuth
│       └── worker/         # Статус воркера
├── lib/
│   ├── ai/                 # OpenRouter + анализатор
│   ├── auth/               # NextAuth конфиг
│   ├── connectors/         # Коннекторы источников
│   │   ├── types.ts        # Интерфейс коннектора
│   │   └── profi.ts        # Profi.ru (Playwright)
│   ├── db/                 # Prisma клиент
│   ├── queue/              # Worker + планировщик
│   └── telegram/           # Уведомления
├── components/
│   └── layout/             # ThemeToggle
└── types/                  # Расширения типов
```

## База данных (10 таблиц)

- `users` — пользователи SaaS
- `sessions` — сессии NextAuth
- `workspaces` — рабочие пространства (тенанты)
- `sources` — источники заявок
- `leads` — заявки
- `lead_analyses` — AI-анализ заявок
- `responses` — сгенерированные отклики
- `settings` — настройки пространства
- `subscriptions` — подписки
- `activity_log` — журнал действий

## SaaS-архитектура

Каждый пользователь имеет Workspace. Все данные изолированы через `workspaceId`. Тарификация через `Subscription`:
- Бесплатный: 1 источник, 50 заявок/день
- Pro (990 ₽/мес): все источники, безлимит, AI-анализ, отклики

## Деплой

```bash
# Docker (PostgreSQL + Redis)
docker-compose up -d

# Приложение
pm2 start npm --name leads-konversus -- run start -- --port 3005

# Воркер
pm2 start npx --name leads-worker -- tsx scripts/worker-run.ts
```

## Переменные окружения

```env
DATABASE_URL=postgresql://leads_user:password@localhost:5433/leads_ai
REDIS_URL=redis://localhost:6379
NEXTAUTH_URL=https://leads.konversus.ru
NEXTAUTH_SECRET=...
AUTH_SECRET=...
AUTH_TRUST_HOST=true
OPENROUTER_API_KEY=sk-or-v1-...
```


## Обновления (день 6)

### Managed партнёры
- Админ создаёт аккаунты клиентов через форму в `/dashboard/admin`
- 4 блока: Основное, Profi.ru, Фильтры, Telegram
- Кнопка «🔑 Войти как» — имперсонация под партнёра
- API: POST /api/admin/partners, GET /api/admin/partners

### Оптимизация скорости
- Интервал опроса: 15/30 сек (в настройках)
- План: тёплый браузер Playwright → экономия 12-15 сек
- Цель: 3-20 секунд от публикации до Telegram

### Документация
- docs/MANAGED-CLIENTS.md — план managed onboarding
- docs/SPEED-OPTIMIZATION.md — оптимизация скорости

## Команды

```bash
npm run dev          # Разработка
npm run build        # Сборка
npm run start        # Продакшен

# Миграции
npx prisma migrate dev
npx prisma generate

# Создать пользователя
npx tsx scripts/seed.ts

# Тест коннектора
npx tsx scripts/test-connector.ts
```
