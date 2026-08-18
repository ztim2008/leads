# Инструкция для агентов — leads.konversus.ru

**GitHub:** https://github.com/ztim2008/leads  
**Production:** https://leads.konversus.ru · PM2 `leads-konversus` · порт `3005`

---

## Открытие дня (перед работой)

1. **План:** [docs/PLAN_2026-08-10.md](docs/PLAN_2026-08-10.md) — этапы, статусы ✅🟡⚪.
2. **Контекст:** [docs/PHASE0_STABILIZATION.md](docs/PHASE0_STABILIZATION.md) — Phase 0 (Profi на хабе выключен).
3. **Политика:** `src/config/hub.ts` → `profiOnHub: false` — **нельзя нарушать**.
4. **Git:** `git pull origin main` → `git status` — не затирай чужие изменения.
5. **Лог:** прочитай последний блок в [DEVLOG.md](DEVLOG.md) (единственный канонический девлог).
6. **Подключение партнёра:** skill [`.cursor/skills/leads-partner-onboard/SKILL.md`](.cursor/skills/leads-partner-onboard/SKILL.md) → [docs/OPERATOR_AGENT.md](docs/OPERATOR_AGENT.md) + `npm run operator:onboard`.

---

## Закрытие дня (обязательно)

Выполняй **все пункты** перед завершением сессии:

### 1. Проверки

```bash
cd /var/www/www-root/data/www/leads.konversus.ru
npm run build
curl -s -o /dev/null -w "%{http_code}" http://localhost:3005/   # ожидаем 200
```

Если меняли PM2: `pm2 save`

### 2. DEVLOG.md

Добавь блок **«Итоги дня · DD месяц YYYY»**:

- что сделано (списком);
- какие файлы затронуты;
- состояние production (PM2, Profi, заявки);
- что осталось на завтра.

**Писать только в `DEVLOG.md` в корне.**  
`docs/devlog.md` — архив до августа 2026, не дополнять.

### 3. План

Обнови статусы задач в [docs/PLAN_2026-08-10.md](docs/PLAN_2026-08-10.md) (⚪→🟡→✅).

### 4. Git commit + push

```bash
git add -A
git status   # убедись: нет .env, node_modules, .next
git commit -m "краткое описание: что и зачем"
git push origin main
```

**Стиль коммитов:** `feat:`, `fix:`, `docs:`, `refactor:`  
**Закрытие дня:** `docs: day close — DD month YYYY — краткое резюме`

### 5. Финальное сообщение пользователю

- что сделано;
- какие проверки прошли;
- был ли deploy (`npm run build` + `pm2 restart leads-konversus`);
- изменённые файлы;
- следующий безопасный шаг.

---

## Git workflow

| | |
|---|---|
| Remote | `origin` → `git@github.com:ztim2008/leads.git` |
| Ветка | `main` (единственная рабочая) |
| SSH на сервере | Ключ `id_ed25519_github_nordicbuilder` (настроен в `core.sshCommand` репозитория) |
| Push | После каждого логического блока работы, минимум — в конце дня |
| Теги | `checkpoint/*` — вехи; `rollback-*` — точки отката. Как откатить: [docs/ROLLBACK.md](docs/ROLLBACK.md) |
| Секреты | `.env` в `.gitignore` — **никогда** в коммит |

```bash
# Типичный цикл агента
git pull origin main
# ... работа ...
npm run build
git add -A && git commit -m "feat: ..." && git push origin main
```

---

## Критические правила (Profi)

- **Никогда** Playwright для Profi на хабе (`109.196.165.106`).
- **Никогда** `pm2 start leads-profi` / не снимать guard в `profi-watcher.ts`.
- **Никогда** восстанавливать `worker.ts` — удалён в Phase 0.
- При ошибке входа Profi: **circuit breaker → стоп**, не авто-рестарт.

---

## Production deploy

```bash
cd /var/www/www-root/data/www/leads.konversus.ru
npm run build
pm2 restart leads-konversus
curl -s -o /dev/null -w "%{http_code}" http://localhost:3005/
pm2 save
```

---

## Документы

| Файл | Назначение |
|------|------------|
| [.cursor/skills/leads-konversus-connect/SKILL.md](.cursor/skills/leads-konversus-connect/SKILL.md) | **Быстрый старт** — SSH, открытие сессии |
| [docs/ROLLBACK.md](docs/ROLLBACK.md) | Как сохранить версию и откатиться |
| [docs/PLAN_2026-08-10.md](docs/PLAN_2026-08-10.md) | Главный план — этапы, статусы, DoD |
| [DEVLOG.md](DEVLOG.md) | **Единственный** активный девлог |
| [docs/PHASE0_STABILIZATION.md](docs/PHASE0_STABILIZATION.md) | Отчёт Phase 0 |
| [docs/TZ_LEADS_AI_V2.md](docs/TZ_LEADS_AI_V2.md) | ТЗ agent v2 |
| [docs/ANTI_BLOCK_PLAN.md](docs/ANTI_BLOCK_PLAN.md) | Анти-блокировка Profi |
| [docs/PARTNER-ONBOARDING.md](docs/PARTNER-ONBOARDING.md) | Онбординг партнёров |
| [docs/devlog.md](docs/devlog.md) | Архив (июнь–июль 2026), только чтение |

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
