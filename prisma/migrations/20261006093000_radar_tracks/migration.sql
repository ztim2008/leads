-- Три потока радара: карточки, Тильда, ИИ. Порог зарплаты и лимит пушей.

ALTER TABLE "job_radar_profile"
  ADD COLUMN IF NOT EXISTS "tilda_queries" TEXT[] NOT NULL DEFAULT ARRAY['Tilda', 'Тильда']::TEXT[],
  ADD COLUMN IF NOT EXISTS "ai_queries" TEXT[] NOT NULL DEFAULT ARRAY['AI-дизайнер', 'AI-креатор', 'ИИ-монтажёр', 'AI видео']::TEXT[];

ALTER TABLE "job_vacancies"
  ADD COLUMN IF NOT EXISTS "track" TEXT NOT NULL DEFAULT 'cards';

CREATE INDEX IF NOT EXISTS "job_vacancies_track_status_idx" ON "job_vacancies"("track", "status");

UPDATE "job_radar_profile"
SET
  "salary_min" = 50000,
  "daily_alert_cap" = 15,
  "require_salary" = false,
  "tilda_queries" = ARRAY['Tilda', 'Тильда']::TEXT[],
  "ai_queries" = ARRAY['AI-дизайнер', 'AI-креатор', 'ИИ-монтажёр', 'AI видео']::TEXT[]
WHERE "id" = 'default';
