# Мост: свой VPS → хостинг клиента (Timeweb / Beget)

Операционная инструкция. Разработка и staging — на хабе `109.196.165.106`.  
Production у клиента — по одному из трёх вариантов ниже.

**Запуск нового клиента с нуля (Beget → DNS → среда → Cursor):**  
[CLIENT_PROJECT_LAUNCH.md](CLIENT_PROJECT_LAUNCH.md)

**Инструменты:** [`scripts/client-bridge/`](../scripts/client-bridge/)

---

## Выбор схемы

| | Когда | Где крутится сайт | Как деплоим |
|---|---|---|---|
| **A (по умолчанию)** | Один продукт, много клиентов | Наш VPS | git → build → PM2 + DNS домена клиента на наш IP |
| **B** | Клиент хочет «у себя» | Мини-VPS клиента (Timeweb Cloud / Beget VPS) | `deploy-to-vps.sh` по SSH |
| **C** | Простой PHP/лендинг | Shared Timeweb/Beget | `rsync-shared.sh` / SFTP |

**Не используем:** Next.js/админка/эквайринг на «обычном» shared + ручной FTP папки `.next`.

- Timeweb shared: Node как веб-сервер недоступен.
- Beget shared: Node через Passenger возможен, но хрупко (лимиты CPU, не наш PM2-цикл) — не база для фабрики.

---

## Вариант A — домен у клиента, приложение у нас

### 1. Staging у нас

1. Клон/проект: `/var/www/www-root/data/www/<project>/`
2. PM2-процесс, свободный порт (не конфликтовать с `3005` leads и др.)
3. Поддомен staging в ISPmanager → proxy на порт (как `leads.konversus.ru` → `127.0.0.1:PORT`)
4. Шаблон proxy: [`scripts/client-bridge/proxy.conf.example`](../scripts/client-bridge/proxy.conf.example)

### 2. Домен клиента (Timeweb / Beget)

В DNS клиента:

```
A     @      109.196.165.106
A     www    109.196.165.106
```

(или `CNAME www` → `@`, если регистратор позволяет)

Почта может остаться у Timeweb/Beget (`MX` не трогаем без нужды).

### 3. Vhost на хабе

Через ISPmanager: сайт с доменом клиента → тот же каталог/порт приложения  
**или** вручную по образцу `leads.konversus.ru.conf` + `vhosts-resources/.../dynamic/proxy.conf`.

SSL: Let’s Encrypt в панели (как у остальных сайтов www-root).

### 4. Эквайринг

Webhook URL:

```text
https://<домен-клиента>/api/payments/webhook
```

Секреты — только в `.env` на сервере (не в git). Пример: [`scripts/client-bridge/env.client.example`](../scripts/client-bridge/env.client.example).

### 5. Много клиентов

Предпочтительно **одна кодовая база** (tenant по `Host` / workspace), а не N полных копий Next: диск хаба уже ~87%.

Чеклист: [`scripts/client-bridge/checklist-variant-a.md`](../scripts/client-bridge/checklist-variant-a.md)

---

## Вариант B — мини-VPS у клиента

### На VPS клиента (один раз)

- Ubuntu 22.04+, Node 20 LTS, nginx, certbot, PM2
- Пользователь deploy + SSH-ключ с хаба
- Репозиторий в `/var/www/<project>` (или как договоритесь)
- Шаблон nginx: [`scripts/client-bridge/nginx-vhost.example.conf`](../scripts/client-bridge/nginx-vhost.example.conf)

### С хаба (каждый релиз)

```bash
cd /var/www/www-root/data/www/leads.konversus.ru
cp scripts/client-bridge/deploy.env.example scripts/client-bridge/deploy.env
# заполнить HOST, USER, REMOTE_DIR, APP_NAME, PORT …

./scripts/client-bridge/deploy-to-vps.sh
```

Скрипт: SSH → `git pull` (или rsync) → `npm ci` → `build` → `pm2 reload`.

Домен в панели Timeweb/Beget → `A` на IP VPS клиента.  
Webhook: `https://<домен>/api/payments/webhook`.

---

## Вариант C — shared + rsync (только PHP/статика)

```bash
./scripts/client-bridge/rsync-shared.sh
```

Нужен `deploy.env` с `REMOTE_HOST`, `REMOTE_USER`, `REMOTE_DIR`, `LOCAL_DIR` (например `out/` или `public_html/`).  
Эквайринг — через PHP-SDK на том же shared.

---

## Запреты

- Playwright / Profi на хабе не относятся к этому мосту — правила хаба не меняются (`profiOnHub: false`).
- Секреты эквайринга и `.env` клиентов — не в git.
- Не плодить десятки полных Next-инстансов без квоты диска и бэкапов.

---

## Связанные документы

- [PARTNER-ONBOARDING.md](PARTNER-ONBOARDING.md) — VPS партнёров Leads (другая задача)
- [YOOKASSA.md](YOOKASSA.md) — эквайринг в контексте Leads
- [ROLLBACK.md](ROLLBACK.md) — откат хаба
