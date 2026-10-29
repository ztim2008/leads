# YouDo — заявки партнёру (анонимный сбор)

**Цель:** первым увидеть новое задание YouDo и откликнуться вручную. Отдельный поток рядом с Profi, свои фильтры, тот же Telegram-бот, в заголовке `🟠 YouDo`.

## Как устроено

| Где | Что |
|-----|-----|
| Хаб | Источник `Source` с `platform: "youdo"` в workspace партнёра. Фильтры — в `source.config` (как у Profi): `titleKeywords`, `titleMinusKeywords`, `keywords`, `minusKeywords`, бюджет, часы. Плюс `categories` (`["webdevelopment"]`), `onlyVirtual`, `pollStepsSec` — ступени паузы, выбирается случайно ±20% (по умолчанию `[60, 180, 360]` = 1/3/6 мин, пол 45 с) |
| Хаб API | Те же `/api/v2/agent/{config,leads,heartbeat,alert}`. В `config` для youdo — блок `youdo` |
| VPS партнёра | PM2 `leads-agent-youdo`, `/opt/leads-agent-youdo`, бандл `public/agent/v2/youdo.bundle.mjs` из `src/agent-core/youdo-agent.ts` + `youdo-collector.ts`. Profi-агент `leads-agent-v2` не трогает |
| Telegram | `formatLeadTelegram`: первая строка `🟠 YouDo · 🔥 Заголовок`, кнопка «Открыть на YouDo», 👥 число откликов из ленты |

Сборщик: headless Chromium открывает `youdo.com/tasks-all-opened-<категория>` (проходит ServicePipe), дальше из контекста страницы через случайную паузу 1/3/6 мин `POST /api/tasks/tasks/` (`onlyVirtual`, `categories`). Новые Id → описание из `__NEXT_DATA__` карточки (`props.initialState.taskState.taskInfo.description`) → хаб. Первый запуск помечает ленту просмотренной (`~/.leads-agent/youdo/<sourceId>/seen.json`). Страница переоткрывается раз в 45 мин. Реклама и счётчики блокируются.

## Риски и правила

- **Никогда не входить в аккаунт YouDo партнёра на VPS** и не делать автоотклики. Аккаунт в сборе не участвует — это главная защита (вход по SMS, YouDo банит исполнителей легко).
- Соглашение YouDo п. 13.8, 13.9, 13.11 запрещает автоматизированную обработку и сбор контента. Анонимный сбор с IP VPS к аккаунту партнёра не привязан, но риск бана IP есть.
- Сбой ленты → одна повторная попытка с переоткрытием страницы → circuit breaker (3 ошибки за 10 мин → пауза 60 мин, алерт `youdo_cb_open`). Не рестартить агент в цикле.
- Заявки YouDo идут в квоту партнёра так же, как Profi (`recordNewLead`).

## Сторож (leads-health)

`watchYouDoAgents` в `src/collectors/health-monitor.ts`, решение — `src/lib/agent/youdo-watch.ts`. Каждые 5 мин, только сообщает админу, ничего не рестартит:

- 🔴 «YouDo-агент молчит N мин» — нет heartbeat 15+ мин (VPS/процесс), круглосуточно;
- 🟠 «YouDo: лента не читается N мин» — в рабочие часы (через 15 мин после начала) нет успешного чтения 20+ мин или CB OPEN/BLOCKED;
- ✅ «снова работает» — после восстановления. Повтор того же алерта — не чаще раза в 2 ч. Состояние в `source.config._watchAlert`.

Агент шлёт `lastFeedOkAt` в heartbeat → `_lastFeedOkAt`.

Канал админа — `resolveAdminChannel()` (`src/lib/telegram/admin-channel.ts`): бот и чат из настроек кабинета админа. `TELEGRAM_BOT_TOKEN` в `.env` — другой бот, админ его не запускал («chat not found»); остаётся запасным.

## Операции

```bash
# установка рядом с Profi-агентом (Playwright берём из Profi-агента)
ssh root@IP 'mkdir -p /opt/leads-agent-youdo && ln -sfn /opt/leads-agent-v2/node_modules /opt/leads-agent-youdo/node_modules \
  && curl -fsSL https://leads.konversus.ru/agent/v2/install-youdo.sh | bash -s YOUDO_SOURCE_ID'
# обновить бандл
ssh root@IP 'cd /opt/leads-agent-youdo && curl -fsSL https://leads.konversus.ru/agent/v2/youdo.bundle.mjs -o youdo.bundle.mjs && pm2 restart leads-agent-youdo'
# логи
ssh root@IP 'pm2 logs leads-agent-youdo --lines 50 --nostream'
```

Пауза: `source.enabled = false` на хабе — агент перейдёт в heartbeat-only после рестарта, хаб перестанет принимать заявки сразу.

## Пилот

Pilot RysyevIV (`pilot@leads.konversus.ru`), VPS `93.188.186.13`, источник `f1a03397-3fbe-4db7-9ec9-a51d626515ea`: web-разработка, только удалённо, слова и минус-слова скопированы с Profi 29.10.2026, бюджет любой, 08:00–22:00 МСК.

## Не сделано (v1)

- Редактирование фильтров YouDo партнёром в кабинете: `applyPartnerFilters` и страница настроек работают только с Profi. Сейчас — правка `source.config` админом.
- YouDo в вечерней сводке флота и в `doctor` (там только Profi).
