# Удаление партнёра (offboard)

> Когда клиент отказался, ушёл или аккаунт больше не нужен.  
> **Не** путать с Phase 0 / Profi на хабе — Playwright только на VPS партнёра.

Связано: [PARTNER-ONBOARDING.md](PARTNER-ONBOARDING.md) · [OPERATOR_AGENT.md](OPERATOR_AGENT.md) · skill `leads-partner-onboard`.

---

## Железобетонно

```
❌ Удалять только строку в админке, оставив leads-agent-v2 online на VPS
❌ Рестартить / чистить Profi на хабе (profiOnHub: false)
❌ Коммитить пароли Profi / SSH / TG token в git или DEVLOG
✅ Сначала остановить агент на VPS → потом БД на хабе → потом снять VPS в панели хостинга
✅ В DEVLOG: email (можно), IP VPS, факт отказа — без секретов
```

---

## Два сценария

| Сценарий | Признак | Что делать |
|----------|---------|------------|
| **A. Полный партнёр** | Есть user в админке, Source, обычно agent на VPS | Полный чеклист ниже |
| **B. Черновик / отказ до onboard** | Нет user в БД; только VPS + заметки в PLAN/DEVLOG | Пункт «Черновик» — хаб не трогать кнопкой 🗑 |

Пример **B:** Мария / `leads-pilot-2` (`83.222.24.212`) — отказ 18.09.2026, в админке не создавали.

---

## Полный чеклист (сценарий A)

### 1. VPS партнёра (обязательно, если IP известен)

```bash
ssh root@IP_ПАРТНЁРА
pm2 stop leads-agent-v2
pm2 delete leads-agent-v2
pm2 save
# опционально снести код:
# rm -rf /opt/leads-agent-v2
```

Проверка: `pm2 list` — процесса `leads-agent-v2` нет.  
Если `login_failed` / CB OPEN — всё равно **stop**, не «починить логин» перед удалением.

### 2. Хаб — удаление учётки

**UI (предпочтительно):** Партнёры → 🗑 у строки → подтверждение.  
API: `POST /api/admin/delete-partner` с телом `{ "email": "partner@…" }` (только role=admin).

Что снимает API сейчас:

- leads, leadAnalysis, responses  
- sources, settings, subscriptions, activityLog  
- workspace, sessions, user  

**Дополнительно вручную (API пока не чистит):**

| Что | Где |
|-----|-----|
| Ideas Board whitelist | Пульт → доступ Ideas / `ideasBoardEmails` — убрать email |
| CRM-карточки, где партнёр owner/creator | `/dashboard/crm` — переназначить или закрыть |
| BillingInvoice / PaymentLog | при необходимости — отдельно в БД (редко) |

Админа (`role=admin`) удалить через этот API **нельзя**.

### 3. Хостинг VPS (биллинг)

В панели Beget / Timeweb / PS.kz:

1. Убедиться, что агент остановлен (шаг 1).  
2. **Удалить или выключить** VPS — иначе продолжают капать ~40 ₽/день (операторский учёт) + тариф провайдера.  
3. IP больше не использовать для нового партнёра без осознанного решения (антиблок: один IP ≈ один контур).

### 4. Документация

- `DEVLOG.md` — короткий блок: email, IP, причина (отказ / уход), что сделано (хаб ✅ / VPS ✅).  
- `docs/PLAN_…` — статус задачи партнёра закрыть (отказ / снят).  
- Секреты из чата не переносить в git.

### 5. Verify, что чисто

```bash
# на хабе
cd /var/www/www-root/data/www/leads.konversus.ru
# user не находится; source с этим _vpsIp нет
npm run operator:verify -- partner@email.ru   # ожидаем: нет пользователя / fail user
```

На бывшем IP: `pm2 list` без `leads-agent-v2` или хост недоступен после удаления VPS.

---

## Черновик до onboard (сценарий B)

Если `operator:onboard` **не** вызывали:

1. В админке **нечего** жать 🗑 — пользователя нет.  
2. На VPS: если ключ хаба уже ставили — можно оставить до удаления машины; агент не должен быть установлен.  
3. В панели хостинга — **удалить VPS** (главный расход).  
4. PLAN/DEVLOG — пометить отказ, убрать из «следующий шаг».

Не создавать «пустышку» в админке только чтобы потом удалить.

---

## Порядок «если торопишься»

```
1) pm2 stop/delete leads-agent-v2 на VPS
2) Админка → 🗑 партнёр (или skip, если черновик)
3) Убрать email из Ideas whitelist
4) Удалить VPS в Beget
5) DEVLOG + PLAN
```

Обратный порядок (сначала БД, агент крутится) → лишние логины Profi / шум / деньги за VPS.

---

## Код на хабе

| Путь | Роль |
|------|------|
| `src/app/api/admin/delete-partner/route.ts` | Удаление user + workspace-данных |
| `src/components/admin/partners-list.tsx` | Кнопка 🗑 |
| `src/lib/ideas/access.ts` | `removeIdeasBoardEmail` |

Улучшения API (invoice/payment/ideas) — по отдельной задаче; до них — ручной чеклист выше.
