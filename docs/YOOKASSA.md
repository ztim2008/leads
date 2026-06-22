# ЮKassa для Leads AI — План

## Ответ на главный вопрос

**Да, ЮKassa работает с поддоменами.** Можно использовать тот же shopId что на konversus.ru. Нужно только добавить webhook URL в личном кабинете.

## Архитектура

```
Партнёр → «Оплатить Pro» → редирект на ЮKassa → оплата
    ↓
ЮKassa → webhook → https://leads.konversus.ru/api/billing/webhook
    ↓
Webhook проверяет подпись → активирует Pro-подписку
    ↓
Партнёр получает: безлимит заявок, AI-отклики, Telegram
```

## Что уже есть на konversus.ru

| Компонент | Статус |
|-----------|--------|
| Shop ID + Secret Key | ✅ В конфиге |
| Webhook обработчик | ✅ `/api/payment-webhook.php` |
| Цена подписки | 700 ₽/мес |

## Что нужно сделать на leads.konversus.ru

### 1. Страница тарифов для партнёра
```
/dashboard/billing
├── Бесплатный: 1 источник, 50 заявок/день
├── Pro (700 ₽/мес): все источники, безлимит, AI
└── Кнопка «Оплатить» → редирект на ЮKassa
```

### 2. API создания платежа
```
POST /api/billing/create
Body: { plan: "pro" }
→ Создаёт платёж в ЮKassa
→ Возвращает confirmation_url (ссылка на оплату)
→ Редирект партнёра
```

### 3. Webhook обработчик
```
POST /api/billing/webhook
← ЮKassa присылает notification
→ Проверяет подпись (secret_key)
→ Если payment.succeeded → активирует Subscription
→ Логирует в БД
```

### 4. Модель Subscription (уже есть!)
```prisma
model Subscription {
  plan            String   // "free" | "pro"
  status          String   // "active" | "expired"
  leadsPerDay     Int      // 50 → 999999
  sourcesLimit    Int      // 1 → 999
  aiAnalysis      Boolean  // false → true
  aiResponses     Boolean  // false → true
  expiresAt       DateTime
}
```

### 5. Проверка лимитов в Worker
```typescript
// Перед сбором заявок
const sub = await getActiveSubscription(workspaceId);
if (!sub) return;

// Лимит заявок в день
const todayCount = await countTodayLeads(workspaceId);
if (todayCount >= sub.leadsPerDay) return;

// Проверка AI
if (!sub.aiAnalysis) apiKey = null;
```

## Что нужно в ЮKassa (личный кабинет)

1. Добавить webhook URL: `https://leads.konversus.ru/api/billing/webhook`
2. Включить уведомления: `payment.succeeded`

Всё. Остальное работает через тот же shopId.

## План внедрения (3-4 часа)

| Шаг | Что | Время |
|-----|-----|-------|
| 1 | Страница /dashboard/billing с тарифами | 1 час |
| 2 | POST /api/billing/create (создание платежа) | 1 час |
| 3 | POST /api/billing/webhook (приём от ЮKassa) | 1 час |
| 4 | Проверка лимитов в worker | 30 мин |
| 5 | Тест-оплата через test_mode | 30 мин |

## Безопасность

- Webhook проверяет IP ЮKassa (опционально)
- Подпись запроса через secret_key
- Идемпотентность (один платёж — одна активация)
- Логирование всех попыток
