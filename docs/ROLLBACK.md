# Сохранение и откат — leads.konversus.ru

Код живёт на GitHub: https://github.com/ztim2008/leads  
Ветка: **`main`**. Секреты (`.env`) в git **не** попадают.

## Две кнопки спокойствия

| Что нужно | Тег | Это что |
|-----------|-----|---------|
| Откатить «на день назад» (закрытие 14.08) | `rollback-2026-08-14` | Последний дневной коммит до фильтров 18.08 |
| Стабильная веха Phase 0 | `checkpoint/phase0-done` | Хаб без Profi, 05.08.2026 |
| Текущая версия (фильтры: заголовок/текст + склонения) | `checkpoint/filters-4.10-stem-20260818` | То, что задеплоено 18.08 |

Список на GitHub: https://github.com/ztim2008/leads/tags

```bash
cd /var/www/www-root/data/www/leads.konversus.ru
git fetch origin --tags
git tag -l 'checkpoint/*' 'rollback-*'
```

## Откат кода хаба (не трогает VPS-агент)

```bash
cd /var/www/www-root/data/www/leads.konversus.ru
git fetch origin --tags
git checkout rollback-2026-08-14          # или другой тег
npm run build
pm2 restart leads-konversus
curl -s -o /dev/null -w "%{http_code}" http://localhost:3005/   # 200
```

Вернуться на свежий `main`:

```bash
git checkout main
git pull origin main
npm run build
pm2 restart leads-konversus
```

**Не делать при откате:** `pm2 start leads-profi`, рестарт `leads-agent-v2` на VPS, Playwright на хабе, сброс circuit breaker.

Откат **не** откатывает заявки в БД и не меняет пароли в `.env`. Это только код хаба.

## Как ставить новую точку (агент / конец дня)

После коммита и `git push origin main`:

```bash
# веха (фича готова)
git tag checkpoint/краткое-имя
git push origin checkpoint/краткое-имя

# точка «можно откатиться сюда»
git tag rollback-YYYY-MM-DD
git push origin rollback-YYYY-MM-DD
```

Теги не удаляем и не двигаем. Новая точка = новый тег.
