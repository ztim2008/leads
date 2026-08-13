---
name: leads-konversus-connect
description: Bootstrap work on leads.konversus.ru — SSH host, project path, open-day checklist, critical Profi rules. Use when the user says connect to leads, ssh nordic leads, leads-konversus, or starts a new session on this project.
---

# Leads Konversus — подключение и старт сессии

## Быстрые факты

| | |
|---|---|
| Проект | Konversus Leads AI |
| Домен | https://leads.konversus.ru |
| Путь на сервере | `/var/www/www-root/data/www/leads.konversus.ru` |
| Сервер | `109.196.165.106` (hostname: `fiwksyqpwx`) |
| GitHub | https://github.com/ztim2008/leads |
| PM2 | `leads-konversus` (порт `3005`), `leads-health` |
| **Запрещено** | Playwright/Profi на хабе — `profiOnHub: false` |

---

## SSH (с локальной машины)

Добавь в `~/.ssh/config`:

```sshconfig
Host leads
    HostName 109.196.165.106
    User root
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes

Host nordic
    HostName 109.196.165.106
    User root
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
```

Подключение:

```bash
ssh leads
# или
ssh nordic
cd /var/www/www-root/data/www/leads.konversus.ru
```

В Cursor: **Remote SSH** → хост `leads` → открыть папку  
`/var/www/www-root/data/www/leads.konversus.ru`

---

## Старт сессии агента (обязательно)

Выполни **до любых правок**:

```bash
cd /var/www/www-root/data/www/leads.konversus.ru
git pull origin main
git status --short
curl -s -o /dev/null -w "%{http_code}" http://localhost:3005/
pm2 list | grep leads
```

Прочитай по порядку:

1. [AGENTS.md](../../../AGENTS.md) — регламент
2. [docs/PLAN_2026-08-10.md](../../../docs/PLAN_2026-08-10.md) — план и статусы ⚪🟡✅
3. Последний блок в [DEVLOG.md](../../../DEVLOG.md)
4. `src/config/hub.ts` — политика хаба

Если доступен MCP `move_agent_to_root` — переключи workspace на  
`/var/www/www-root/data/www/leads.konversus.ru`.

---

## Критические правила (не нарушать)

```
❌ pm2 start leads-profi / Playwright Profi на хабе
❌ Восстанавливать worker.ts
❌ Авто-рестарт при ошибке входа Profi
✅ Profi только через VPS-агент (Phase 1+)
✅ Закрытие дня по AGENTS.md § «Закрытие дня»
```

---

## Стартовый промпт для нового чата

Скопируй пользователю:

```
Подключись к leads.konversus.ru по skill leads-konversus-connect.
Прочитай AGENTS.md, PLAN_2026-08-10.md и docs/NEXT_SESSION_2026-08-14.md.
Пилот RysyevIV online — наблюдение 4.6, не рестартить агент.
```

Подключение **нового партнёра** — отдельный skill:  
`.cursor/skills/leads-partner-onboard/SKILL.md`  
(«подключи партнёра» + блок Email / Profi / VPS / TG).

---

## Закрытие дня (кратко)

1. `npm run build` + curl `localhost:3005` → 200
2. `DEVLOG.md` → «Итоги дня · DD месяц YYYY»
3. Обновить статусы в `docs/PLAN_2026-08-10.md`
4. `git commit` + `git push origin main`
5. `pm2 save` (если меняли PM2)

Полный чеклист: [AGENTS.md](../../../AGENTS.md)
