# Partner Zoom deck — Leads.Konversus

Презентация для Zoom с партнёрами (текст UP OR OUT, 21.08.2026).

## Ссылки (production)

| Формат | URL |
|--------|-----|
| HTML (полный экран, ←/→, `F` fullscreen) | https://leads.konversus.ru/partner-zoom.html |
| HTML (копия в папке) | https://leads.konversus.ru/presentations/partner-zoom/index.html |
| PowerPoint | https://leads.konversus.ru/Leads-Konversus-Partner-Zoom.pptx |

Локально на сервере:

- `public/partner-zoom.html`
- `public/Leads-Konversus-Partner-Zoom.pptx`
- `public/presentations/partner-zoom/` (оба файла)

## Слайды (13)

1. Титул  
2. Для кого А — строители / ремонтники  
3. Для кого Б — юристы / бухгалтеры  
4. Проблема (10% / 90%)  
5. Решение Leads.Konversus  
6. Фильтры под вас  
7. Безопасность (Light / Balanced / Stealth)  
8. Результаты (график 2–3 → 25+)  
9. Сравнение (таблица)  
10. Тарифы Мастер / Команда / Бизнес + пробная неделя 7 000 ₽  
11. 6 причин (УТП)  
12. CTA  
13. Контакты  

## Пересборка PPTX

```bash
python3 scripts/build-partner-pptx.py
cp public/presentations/partner-zoom/Leads-Konversus-Partner-Zoom.pptx public/
# при новых файлах в public: pm2 restart leads-konversus
```

## Важно (оператору)

Цифры и тарифы в колоде — **маркетинговые** из брифа Zoom (подписка 19 990 / 30 000 / 50 000, лид 100–400 ₽, пробная неделя 7 000 ₽).  
Фактическая операторская экономика (подключение / сопровождение / VPS / AI) — в `docs/LOGISTICS.md` и CJM. Перед обещаниями на созвоне сверьте с актуальной офертой.
