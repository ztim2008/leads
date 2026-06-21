# Оптимизация скорости: перехват заказов Profi.ru

## Текущий поток (3-5 минут от публикации до Telegram)

```
Profi: заказ опубликован
    ↓ 0-60 сек (ждём следующий цикл опроса)
Worker: pollAllSources()
    ↓ 2-3 сек (поиск sources в БД)
Worker: processSource()
    ↓ 15-20 сек (Playwright: открыть браузер → зайти → логин → парсинг → закрыть)
Worker: дедупликация
    ↓ 1-2 сек (AI анализ каждой заявки последовательно)
Worker: notifyFast() → Telegram
    ↓ 2-3 сек (отправка через Bot API)
Клиент: видит заявку в Telegram
────────────────────────────────────────
ИТОГО: 20-90 секунд задержки
```

## Целевой поток (5-15 секунд)

```
Profi: заказ опубликован
    ↓ 0-15 сек (частый опрос: каждые 15-30 сек)
Worker: pollAllSources() 
    ↓ 3-5 сек (тёплый браузер Playwright)
Worker: notifyFast() → Telegram МГНОВЕННО
    ↓ 2-3 сек
Клиент: видит заявку в Telegram
    ↓
Worker: AI анализ (параллельно, не блокируя)
    ↓
Worker: повторное сообщение с AI-оценкой
────────────────────────────────────────
ИТОГО: 5-20 секунд
```

## Что оптимизировать

### 1. Тёплый браузер Playwright (экономия 12-15 сек)

Сейчас: каждый цикл → новый browser → новый context → логин → парсинг → закрыть.

Надо: browser запускается ОДИН раз при старте worker. Context/page переиспользуются.

```typescript
let warmBrowser: Browser | null = null;
let warmPage: Page | null = null;

async function getWarmPage(login: string, password: string): Promise<Page> {
  if (warmPage) {
    try { await warmPage.url(); return warmPage; } // ещё жива
    catch { warmPage = null; }
  }
  if (!warmBrowser) warmBrowser = await chromium.launch({ headless: true });
  const ctx = await warmBrowser.newContext({ viewport: { width: 1920, height: 1080 } });
  warmPage = await ctx.newPage();
  // Логин...
  return warmPage;
}
```

Экономия: 12-15 секунд на каждом цикле.

### 2. Интервал 15-30 секунд (экономия 30-45 сек)

Добавить в настройки: 15 сек, 30 сек, 1 мин, 3 мин, 5 мин.

```typescript
// checkInterval в БД: 0.25 = 15 сек, 0.5 = 30 сек
const ms = (s.checkInterval || 3) * 60 * 1000;
```

### 3. Мгновенное уведомление ДО AI (уже есть)

`notifyFast()` отправляет как только заявка обнаружена. Не ждёт AI.

### 4. Параллельный AI (экономия 2-3 сек)

Сейчас анализ последовательный. Надо:

```typescript
await Promise.all(newLeads.map(async (lead) => {
  const analysis = await analyzeLead(lead.title, lead.description, { apiKey });
  await db.leadAnalysis.create({...});
  // Telegram only for high scores
  if (analysis.score >= 70) await sendLeadNotification(...);
}));
```

### 5. Пул соединений (экономия 1-2 сек)

HTTP keep-alive для Telegram Bot API. Не открывать новый connect на каждое сообщение.

## Приоритет внедрения

| # | Оптимизация | Экономия | Сложность |
|---|------------|----------|-----------|
| 1 | Тёплый браузер | 12-15 сек | Средняя |
| 2 | Интервал 15-30 сек | 30-45 сек | Лёгкая |
| 3 | Параллельный AI | 2-3 сек | Лёгкая |
| 4 | HTTP keep-alive | 1-2 сек | Лёгкая |

## Что ещё

- **Мониторинг задержки**: логировать время от fetchLeads до notifyFast
- **Метрика в дашборде**: «Среднее время доставки: 8 сек»
- **Алерт при задержке > 60 сек**: Telegram админу
