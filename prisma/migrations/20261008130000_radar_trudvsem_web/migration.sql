-- Поток «Веб» и профиль: удалёнка по всей России, сайты и AI-разработка.

ALTER TABLE "job_radar_profile"
  ADD COLUMN IF NOT EXISTS "web_queries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "job_radar_profile"
SET
  "specialization" = 'Дизайнер маркетплейсов, веб и AI',
  "about" = '7 лет делаю карточки и инфографику для Wildberries, Ozon, Avito, Lamoda, Яндекс Маркета и Яндекс Кита. Figma, Photoshop, CorelDRAW, Illustrator. Нейросети для изображений: Midjourney, Runway, Kling. Делаю и веду сайты, лендинги и веб-приложения, настраиваю рекламу и продвижение, разрабатываю AI-агентов и автоматизацию. Ищу долгосрочную удалённую работу по всей России. Портфолио: https://konversus.ru/portfolio/timeline',
  "skills" = ARRAY['Figma', 'Photoshop', 'CorelDRAW', 'Illustrator', 'Midjourney', 'Runway', 'Kling', 'генерация изображений']::TEXT[],
  "directions" = ARRAY['Wildberries', 'Ozon', 'Avito', 'Lamoda', 'Яндекс Маркет', 'Яндекс Кит', 'Инфографика', 'Карточки товаров']::TEXT[],
  "formats" = ARRAY['удалёнка', 'по всей России', 'долгосрочная работа']::TEXT[],
  "exclusions" = ARRAY['офис', 'продажи']::TEXT[],
  "remote_only" = true,
  "web_queries" = ARRAY['веб-разработчик', 'разработчик сайтов', 'веб-дизайнер', 'frontend разработчик', 'AI-разработчик', 'AI engineer']::TEXT[]
WHERE "id" = 'default';
