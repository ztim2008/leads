# Чеклист запуска клиентского проекта

Полный текст: [docs/CLIENT_PROJECT_LAUNCH.md](../../docs/CLIENT_PROJECT_LAUNCH.md)

## 0. Бриф
- [ ] Email клиента для Beget
- [ ] Домен согласован, свободен
- [ ] Slug проекта, свободный PORT на хабе
- [ ] MVP: лендинг / кабинет / оплата / бот
- [ ] `df -h` — достаточно места

## 1. Beget
- [ ] Аккаунт на почте клиента
- [ ] 2FA / пароль в сейфе
- [ ] Shared-хостинг Node **не** покупали

## 2. Домен + DNS
- [ ] Домен куплен в Beget
- [ ] `A @` и `A www` → `109.196.165.106`
- [ ] MX почты не сломаны (если нужна почта)
- [ ] `dig +short домен A` → IP хаба

## 3. Код + БД
- [ ] `/var/www/www-root/data/www/<slug>/`
- [ ] Git remote (private)
- [ ] Отдельный Postgres user + DB
- [ ] `.env` из `env.client.example` (не в git)
- [ ] `npm ci` + migrate + `build` OK

## 4. Nginx + PM2 + SSL
- [ ] Сайт в ISPmanager
- [ ] proxy.conf → `127.0.0.1:PORT`
- [ ] Let’s Encrypt
- [ ] `pm2 start` + `pm2 save`
- [ ] `https://домен/` отвечает

## 5. Cursor
- [ ] SSH host `nordic` / `leads`
- [ ] Open Folder = только каталог проекта
- [ ] `AGENTS.md` / rules для агента
- [ ] Первый промпт с портом, доменом, запретами

## 6. Оплаты и бот
- [ ] Кабинет эквайринга на клиента
- [ ] Webhook `https://домен/api/payments/webhook`
- [ ] Тестовый платёж OK
- [ ] Telegram-бот отдельный (если нужен)

## 7. Сдача
- [ ] Доступы Beget у клиента
- [ ] Сейф студии: env, БД, PM2, repo
- [ ] Бэкап БД учтён
- [ ] Запись в лог студии
