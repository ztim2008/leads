# Пауза партнёра (без удаления учётки)

> Когда нужно **перестать платить за VPS**, но позже снова подключить того же партнёра.  
> **Не** путать с [PARTNER_OFFBOARD.md](PARTNER_OFFBOARD.md) — там полное удаление (🗑 + БД).

Связано: [OPERATOR_AGENT.md](OPERATOR_AGENT.md) · [PARTNER-ONBOARDING.md](PARTNER-ONBOARDING.md) · skill `leads-partner-onboard`.

---

## Пауза vs удаление

| | **Пауза** (этот документ) | **Offboard** |
|---|---|---|
| User / Source / Profi в БД | **Оставить** | Удалить 🗑 |
| Сбор (`source.enabled`) | Выключить | — |
| Агент на VPS | `pm2 stop` + `delete` | То же |
| VPS в Beget / Timeweb | **Удалить** (стоп биллинга) | Удалить |
| Позже снова | Новый VPS + `install.sh` тем же `SOURCE_ID` | Полный `operator:onboard` |

```
❌ Жмать 🗑 в админке «на паузе» — потом onboard с нуля
❌ Оставить VPS в панели хостинга — деньги капают
❌ Playwright / pm2 leads-profi на хабе (profiOnHub: false)
✅ Сначала stop агента → потом удалить VPS → учётка на хабе жива
✅ В DEVLOG: email, старый IP, факт паузы — без паролей
```

---

## Чеклист паузы

### 1. Хаб — сбор выкл

Админка / Пульт → пауза сбора у партнёра (`source.enabled = false`).  
Квоту/подписку при необходимости поставить в `paused` (биллинг оператора) — отдельно от VPS.

### 2. VPS — остановить агент

```bash
ssh root@IP_ПАРТНЁРА
pm2 stop leads-agent-v2
pm2 delete leads-agent-v2
pm2 save --force
pm2 list   # пусто, без leads-agent-v2
```

Код в `/opt/leads-agent-v2` можно не сносить — машину всё равно удаляем.

### 3. Хостинг — удалить VPS (главное для денег)

В панели Beget / Timeweb / PS.kz:

1. Найти сервер по имени или IP.
2. **Удалить** VPS (не «остановить» навсегда без снятия с тарифа — смотри условия провайдера).
3. Убедиться, что в списке серверов машины больше нет и списание не идёт.

IP после удаления **не** переиспользовать под другого партнёра без осознанного решения (антиблок).

### 4. Хаб — что не трогать

- User, Workspace, Source, Profi login/password в `config`
- Telegram chat id / токен сервиса
- `SOURCE_ID` (= `source.id`) — он нужен для reconnect

Старый `_vpsIp` можно оставить как пометку или затереть при следующем подключении.

### 5. DEVLOG

Короткий блок: email, IP, «пауза (не offboard)», агент ✅ stop, VPS ✅ удалён в панели / ⏳ ждёт удаления.

---

## Переподключение (безболезненно)

Нужны: тот же email партнёра, тот же `SOURCE_ID`, новый VPS с root SSH.

### 1. Купить новый VPS

Регион/провайдер — по политике антиблока. Записать **новый IP**.

### 2. Сохранить IP на хабе

Вариант A — Помощник в админке: «IP … для email@…»  
Вариант B — онбординг-хаб партнёра: поле VPS IP → сохранить.

Под капотом: `config._vpsIp` у source. Пароль SSH в БД **не** пишется.

### 3. Install агента на новом VPS

`SOURCE_ID` взять из карточки доступа / verify / админки (id source Profi):

```bash
ssh root@НОВЫЙ_IP
curl -fsSL https://leads.konversus.ru/agent/v2/install.sh | bash -s "SOURCE_ID"
pm2 status   # leads-agent-v2 online
```

`operator:onboard` **не** вызывать — партнёр уже в БД. Profi-пароль уже в source.

### 4. Verify + включить сбор

```bash
cd /var/www/www-root/data/www/leads.konversus.ru
npm run operator:verify -- partner@email.ru
```

Ожидание: user ✅, vps_ip = новый, agent_heartbeat online (<15 мин), circuit CLOSED.  
Затем Пульт → возобновить сбор, если период/квота позволяют.

---

## Кейс: пилот `leads-pilot-1` (25.09.2026)

| Поле | Значение |
|------|----------|
| Email | `pilot@leads.konversus.ru` |
| Profi | `RysyevIV` |
| SOURCE_ID | `24fe85d0-2e95-4b48-a5ad-dad019c1681d` |
| Старый VPS | Beget `leads-pilot-1`, host `mspjepvaoq`, IP `159.194.213.198` |
| Агент | остановлен и удалён из PM2 (25.09.2026) |
| Сбор | `enabled: false` |
| Учётка | **не** удалять |

**Снять с оплаты:** в [Beget](https://cp.beget.com) → VPS → `leads-pilot-1` / `mspjepvaoq` / `159.194.213.198` → **Удалить**.

**Reconnect later:** новый VPS → сохранить IP для `pilot@…` →  
`curl -fsSL https://leads.konversus.ru/agent/v2/install.sh | bash -s "24fe85d0-2e95-4b48-a5ad-dad019c1681d"` → verify → ▶ сбор.

---

## Порядок «если торопишься»

```
1) source.enabled = false
2) pm2 stop/delete leads-agent-v2 на VPS
3) Удалить VPS в Beget
4) DEVLOG: пауза, не offboard
5) (позже) новый IP → install.sh SOURCE_ID → verify → сбор
```
