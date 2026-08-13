---
name: leads-partner-onboard
description: >-
  Onboard a Konversus Leads partner end-to-end: parse paste, operator CLI,
  VPS agent v2 install, verify, access card, final report. Use when the user
  says подключи партнёра, onboard partner, новый партнёр, operator:onboard,
  install agent v2, or pastes Email/Profi/VPS/Telegram fields.
---

# Подключение партнёра — leads.konversus.ru

Работаешь **на хабе** `/var/www/www-root/data/www/leads.konversus.ru` (не выдумывай другой сервер).
Playbook-детали: [docs/OPERATOR_AGENT.md](../../../docs/OPERATOR_AGENT.md).
Старт сессии (если ещё не на хабе): skill `leads-konversus-connect`.

## Железобетонно

```
❌ Playwright / pm2 start leads-profi на хабе (109.196.165.106)
❌ Рестарт агента при login_failed / SMS / капча — CB → стоп, ждать человека
❌ Пароли в git / DEVLOG / коммит
❌ Выдумывать недостающие поля (email, Profi, пароли)
✅ Profi только на VPS партнёра (install.sh → leads-agent-v2)
✅ Один путь: operator:parse → onboard → SSH install → verify → отчёт
```

`src/config/hub.ts` → `profiOnHub: false` не трогать.

## Что нужно от админа (блок в чат)

Минимум:

```text
Email: partner@example.ru
Пароль входа: Partner2026
Имя: Иван
Profi логин: specialist_login
Profi пароль: profi_secret
Лимит: 500
IP: 159.194.213.198
SSH пароль VPS: (только в чат, не в БД)
Chat ID: 123456789
Ключевые слова: сайт, лендинг
```

- **Telegram:** партнёр **не** создаёт бота. Chat ID после `/start` у `@leadskonversus_bot` (или `@userinfobot`). Bot Token в блоке **не обязателен** — подставь токен сервиса с хаба (`.env` `TELEGRAM_BOT_TOKEN` или settings админа `bilariuss@yandex.ru`). Не вписывай токен в скилл и не коммить.
- Нет Chat ID → onboard без TG, в отчёте: «нужен /start @leadskonversus_bot + Chat ID».
- Нет SSH пароля/ключа → onboard на хабе, install отложить, в отчёте явный блокер.
- Старые Profi (TimofeyevAG11, RysyevVO) **не использовать**.

## Процедура (не пропускай шаги)

Рабочая папка: `cd /var/www/www-root/data/www/leads.konversus.ru`

### 1. Parse (без записи в БД)

```bash
npm run operator:parse -- --paste <<'EOF'
…блок админа…
EOF
```

Есть `error` → запроси поля у админа, **стоп**. Warn можно продолжать с явным упоминанием.

### 2. Dry-run (по желанию) → Onboard

```bash
npm run operator:onboard -- --dry --paste <<'EOF'
…
EOF

npm run operator:onboard -- --paste <<'EOF'
…
EOF
```

Или флаги: `--email --password --profiLogin --profiPassword --leadsPerMonth --vpsIp --telegramChatId --telegramToken --keywords`.

Сохрани из вывода: `Email`, пароль входа, `Source` (SOURCE_ID), `install_cmd`, VPS IP. Это карточка доступа.

### 3. VPS install (не хаб)

Только `IP` из блока ≠ `109.196.165.106`.

```bash
# ключ хаба, если ещё не добавлен:
ssh-copy-id / sshpass + запись ~/.ssh/authorized_keys на VPS

ssh root@IP_ПАРТНЁРА 'curl -fsSL https://leads.konversus.ru/agent/v2/install.sh | bash -s "SOURCE_ID"'
ssh root@IP_ПАРТНЁРА 'pm2 status'   # leads-agent-v2 online
```

Install.sh должен подхватить `.env` (SOURCE_ID) и `npx playwright install-deps chromium`. Если `SOURCE_ID не задан` — почини launcher/`.env`, не крути логин Profi.

При `login_failed` / SMS / капча: **`pm2 stop leads-agent-v2`**, CB не сбрасывай пачкой, в отчёте: «партнёр у компа, SMS, не рестартить».

### 4. Verify

```bash
npm run operator:verify -- partner@email.ru
```

Нужны ✅: user, workspace, quota, profi_source, vps_ip, install_cmd.  
heartbeat — после install (до 15 мин). telegram — warn если нет chat.  
leads_count=0 сразу после install — норма, не ошибка.

### 5. Карточка в админке

Админ видит те же секреты: Партнёры → **Доступ**, или Пульт → строка партнёра. Не дублируй полный пароль Profi в DEVLOG.

## Отчёт админу (обязательно, в конце)

Коротко, по шаблону:

```
## Онбординг: {email} / {имя}

Статус: ✅ готово | 🟡 хаб ок, ждём VPS/TG/SMS | ❌ блокер

Характеристики:
- Source: …
- VPS: …
- Profi логин: … (пароль — в карточке «Доступ», не сюда)
- TG chat: … / нет
- Лимит: …
- pm2: leads-agent-v2 online|stopped|не ставили
- verify: какие ✅ / ❌
- CB: CLOSED|OPEN|н/д

Сделано: parse / onboard / install / verify / TG

Дальше (рекомендации, 1–3 пункта):
- …
Нельзя: рестартить Profi на хабе; жать логин при SMS.
```

Если не готово — **не** маскируй. Один главный блокер + что нужно от админа (SMS, SSH, Chat ID).

## Частые сбои

| Симптом | Действие |
|---------|----------|
| Email уже есть | `operator:verify -- email`, не создавать второго |
| SSH Permission denied | ключ хаба в `authorized_keys` или новый пароль Beget; консоль VPS |
| `SOURCE_ID не задан` | `/opt/leads-agent-v2/.env` + launcher читает `.env` |
| `libatk` / chromium | `npx playwright install-deps chromium` на VPS |
| login_failed | стоп агента, ждать партнёра у компа |
| heartbeat offline | `pm2 logs leads-agent-v2` на VPS, не рестарт на хабе |
| заявки тебе, не партнёру | Chat ID партнёра в settings, токен `@leadskonversus_bot` |

## Не в этом скилле

Единый бот 4.9 (фильтры в TG), AES паролей, рестарт Playwright на хабе, закрытие дня (это `AGENTS.md`).
