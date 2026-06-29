# 🤖 Агент Konversus Leads AI

> **Версия:** 1.0 (готовится к запуску)
> **Для кого:** Партнёры сервиса leads.konversus.ru

---

## 📋 Что это

Агент — минимальный Docker-контейнер, который запускается на **вашем VPS** и собирает заявки с Profi.ru. Заявки отправляются на центральный сервер leads.konversus.ru.

**Зачем:** Каждый партнёр работает со своего IP — Profi видит обычного человека, а не ботоферму. Нулевой риск блокировки.

---

## 🚀 Быстрый старт (3 шага)

### Шаг 1 — Купить VPS

Любой российский хостинг, минимальный тариф (~300-400₽/мес):
- **Beget** — от 350₽/мес
- **Timeweb** — от 400₽/мес
- **RUVDS** — от 300₽/мес

Требования: Ubuntu 20.04+, 1 vCPU, 512 MB RAM, внешний IPv4.

### Шаг 2 — Установить Docker

```bash
curl -fsSL https://get.docker.com | sh
```

### Шаг 3 — Запустить агента

```bash
docker run -d --name leads-agent \
  --restart always \
  -e TOKEN="ваш_токен_от_админа" \
  -e API_URL="https://leads.konversus.ru/api/agent" \
  ghcr.io/konversus/leads-agent:latest
```

Готово! Агент запущен, заявки пойдут в ваш Telegram автоматически.

---

## ⚙️ Как это работает

```
Ваш VPS (свой IP)
  └── Docker-контейнер с агентом
       ├── Подключается к Profi.ru (ваш логин/пароль)
       ├── Следит за новыми заказами (ждун 👀)
       ├── Находит заявки → отправляет на API leads.konversus.ru
       └── Вы получаете уведомления в Telegram

Profi видит: обычный человек зашёл с домашнего IP
Риск бана: нулевой (ваш личный IP, не общий сервер)
```

---

## 🔧 Управление

```bash
# Статус
docker logs leads-agent --tail 20

# Перезапуск
docker restart leads-agent

# Обновление
docker pull ghcr.io/konversus/leads-agent:latest
docker stop leads-agent && docker rm leads-agent
# затем снова Шаг 3

# Остановка
docker stop leads-agent
```

---

## 📞 Поддержка

- Telegram: @konversus_support
- Email: поддержка выдаётся админом

---

*Документация подготовлена. Агент на стадии упаковки.*
