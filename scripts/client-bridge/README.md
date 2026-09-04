# Client hosting bridge — скрипты

Рабочий мост «разработка на нашем VPS → production у клиента».

Полная схема: [docs/CLIENT_HOSTING_BRIDGE.md](../../docs/CLIENT_HOSTING_BRIDGE.md)

| Файл | Назначение |
|------|------------|
| `deploy-to-vps.sh` | Вариант B: SSH-деплой на мини-VPS клиента |
| `rsync-shared.sh` | Вариант C: выгрузка статики/PHP на shared |
| `deploy.env.example` | Конфиг деплоя (скопировать в `deploy.env`, не коммитить) |
| `env.client.example` | Пример `.env` приложения с эквайрингом |
| `nginx-vhost.example.conf` | Nginx на VPS клиента (вариант B) |
| `proxy.conf.example` | Proxy-фрагмент под ISPmanager (вариант A на хабе) |
| `checklist-variant-a.md` | Чеклист онбординга домена на наш IP |
| `checklist-variant-b.md` | Чеклист мини-VPS клиента |
| `checklist-launch.md` | Сквозной запуск: Beget → домен → VPS → Cursor |

## Сквозной запуск нового клиента

Полный playbook: [docs/CLIENT_PROJECT_LAUNCH.md](../../docs/CLIENT_PROJECT_LAUNCH.md)

## Быстрый старт (B)

```bash
cd /var/www/www-root/data/www/leads.konversus.ru
cp scripts/client-bridge/deploy.env.example scripts/client-bridge/deploy.env
$EDITOR scripts/client-bridge/deploy.env
./scripts/client-bridge/deploy-to-vps.sh
```

`deploy.env` в `.gitignore` через общий паттерн `*.env` / явное правило — см. корень `.gitignore`.
