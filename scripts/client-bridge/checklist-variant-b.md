# Чеклист: вариант B (мини-VPS клиента)

## Один раз на VPS

- [ ] Ubuntu 22.04+, Node 20, nginx, certbot, PM2
- [ ] Пользователь `deploy`, SSH-ключ с хаба
- [ ] Каталог приложения, `git clone` (или пустой dir под rsync)
- [ ] `.env` из `env.client.example`
- [ ] Nginx по `nginx-vhost.example.conf`, SSL
- [ ] DNS домена в Timeweb/Beget → IP VPS
- [ ] На хабе: `deploy.env` из `deploy.env.example`

## Каждый релиз с хаба

- [ ] `./scripts/client-bridge/deploy-to-vps.sh`
- [ ] HTTP health на remote localhost:PORT OK
- [ ] `https://домен/` OK
- [ ] Webhook эквайринга жив после деплоя
