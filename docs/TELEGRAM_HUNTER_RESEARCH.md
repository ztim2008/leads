# 🦅 Telegram Hunter — Исследование

> **Дата:** 29 июня 2026
> **TL;DR:** `messages.searchGlobal` ищет только в каналах куда мы вступили. Глобальный поиск без вступления — `channels.searchPosts` (платный, Telegram Stars).

---

## 📚 Библиотеки

| Библиотека | Статус | Вердикт |
|-----------|--------|---------|
| **GramJS** (`npm i telegram`) | ✅ Активна, 1.8k★ | **Выбор** — прямой MTProto, `searchGlobal`, `searchPosts` |
| tdl/TDLib | Активна, 535★ | Перебор — тянет всю БД сообщений |
| @mtproto/core | Архив 09.2024 | ❌ Устарела, нет новых методов |

---

## 🔍 Ключевое открытие

### `messages.searchGlobal` — НЕ подходит

Ищет **только в наших диалогах** (где мы состоим). Для поиска заявок нужно вступить в сотни групп — подозрительно и лимит ~500 каналов на аккаунт.

### `channels.searchPosts` — подходит, но платный

Ищет по **всем публичным каналам**, без вступления. Но после исчерпания бесплатных запросов — стоит Telegram Stars.

```typescript
// GramJS: глобальный поиск по публичным каналам
import { Api } from "telegram";

// 1. Проверить лимит
const flood = await client.invoke(
  new Api.channels.CheckSearchPostsFlood({ q: "ремонт квартир" })
);
console.log(`Осталось: ${flood.remains} из ${flood.totalDaily}`);

// 2. Поиск
const result = await client.invoke(
  new Api.channels.SearchPosts({
    q: "ищу мастера ремонт",
    offsetRate: 0,
    offsetPeer: new Api.InputPeerEmpty(),
    offsetId: 0,
    limit: 50,
  })
);
// result.messages, result.chats, result.users
```

---

## 💡 Три стратегии

### 🥇 Стратегия A: Вступить + индексировать (бесплатно)

1. Найти 20-50 ключевых каналов/групп
2. Вступить в них
3. Разово скачать историю (`messages.getHistory`)
4. Индексировать в SQLite FTS5 или JSON-файл
5. Искать локально (без API-запросов к Telegram)

✅ Бесплатно, быстро
❌ Статично — новые сообщения не видны без периодической индексации

### 🥈 Стратегия B: channels.searchPosts (платно)

1. Раз в 30 мин делать `channels.searchPosts`
2. Бесплатные запросы Premium-аккаунта
3. При исчерпании — докупать Stars

✅ Глобальный охват, всегда свежие
❌ Платно после лимита

### 🥉 Стратегия C: Гибрид (рекомендую)

1. Вступить в 20-50 ключевых каналов
2. Индексировать их историю локально (бесплатно)
3. Раз в 30 мин: `channels.searchPosts` для свежих заявок
4. Хранить индекс в SQLite — 99% поиска бесплатно
5. `channels.searchPosts` — только для нового с последнего запуска

✅ 99% бесплатно, 1% платно
✅ Всегда актуально

---

## 🏗️ Практическая архитектура

```
src/lib/hunters/telegram/
├── client.ts          # GramJS клиент + сессия
├── indexer.ts         # Индексация каналов (разово + периодически)
├── search.ts          # Поиск (локальный + API)
├── filter.ts          # NLU-фильтр
├── dedup.ts           # Дедупликация
├── keywords.ts        # Ключевые слова
└── channels.ts        # Список каналов для индексации

Данные:
├── data/channels.json # Список каналов + последний indexed_id
├── data/index.db      # SQLite FTS5 индекс
└── .env               # SESSION_STRING, API_ID, API_HASH
```

### Индексация (разово + каждый час)

```typescript
// Для каждого канала:
for (const channel of CHANNELS) {
  const lastId = getLastIndexedId(channel);
  const messages = await client.getMessages(channel, {
    limit: 100,
    minId: lastId, // только новые с последней индексации
  });
  
  for (const msg of messages) {
    if (isRelevant(msg.text)) {
      db.insert({
        id: msg.id,
        chatId: channel.id,
        chatTitle: channel.title,
        text: msg.text,
        date: msg.date,
      });
    }
  }
  
  updateLastIndexedId(channel, messages[0]?.id || lastId);
}
```

### Поиск (каждые 30 мин)

```typescript
// 1. Локальный поиск по FTS5 (мгновенно, бесплатно)
const localResults = db.search(`
  SELECT * FROM messages 
  WHERE text MATCH 'ищу мастера OR нужен ремонт OR посоветуйте'
  AND date > datetime('now', '-1 hour')
  ORDER BY date DESC
`);

// 2. API-поиск для сверхсвежих (платно, опционально)
const apiResults = await client.invoke(
  new Api.channels.SearchPosts({
    q: "ищу мастера ремонт",
    limit: 20,
  })
);
```

---

## 📋 Список каналов для индексации (начальный)

| Канал/Группа | Участников | Ниша |
|-------------|-----------|------|
| @obyavleniya_msk | 50K+ | Объявления Москва |
| @remont_stroyka | 12K+ | Ремонт и стройка |
| @santekhnika_msk | 8K+ | Сантехника Москва |
| @flat_design | 15K+ | Дизайн интерьеров |
| @raion_cheryomushki | 2K+ | Районный чат |
| @zhk_solnechny | 3K+ | Чат ЖК |

Плюс ещё 10-15 каналов подбираются вручную по нишам.

---

## 💰 Экономика

| Статья | Стратегия A | Стратегия C (гибрид) |
|--------|------------|---------------------|
| Сервер | 0 ₽ (Nordic) | 0 ₽ |
| Telegram API | 0 ₽ | ~$1-2/мес Stars |
| SQLite | 0 ₽ | 0 ₽ |
| Разработка | ~4ч | ~5.5ч |
| Поддержка | 15 мин/нед | 15 мин/нед |

---

## 🚦 Риски

| Риск | Решение |
|------|---------|
| Бан за вступление в 50+ каналов | Не вступать в >30-50, делать постепенно |
| FLOOD_WAIT при индексации | Паузы 2-3 сек между запросами |
| Сжатие сессии | StringSession в .env, авто-реконнект |
| Неактуальность индекса | Периодическая реиндексация каждый час |

---

*Исследование: 29 июня 2026. Переходим к реализации.*
