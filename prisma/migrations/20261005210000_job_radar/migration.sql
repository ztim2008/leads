-- Job Radar: личный контур админа, отдельно от заявок партнёров

CREATE TABLE IF NOT EXISTS "job_radar_profile" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "specialization" TEXT NOT NULL DEFAULT 'AI-дизайнер / AI-креатор',
  "directions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "formats" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "exclusions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "search_queries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "salary_min" INTEGER NOT NULL DEFAULT 70000,
  "require_salary" BOOLEAN NOT NULL DEFAULT true,
  "remote_only" BOOLEAN NOT NULL DEFAULT true,
  "match_min" INTEGER NOT NULL DEFAULT 85,
  "trust_min" INTEGER NOT NULL DEFAULT 70,
  "daily_alert_cap" INTEGER NOT NULL DEFAULT 5,
  "quiet_start" TEXT NOT NULL DEFAULT '23:00',
  "quiet_end" TEXT NOT NULL DEFAULT '08:00',
  "alerts_enabled" BOOLEAN NOT NULL DEFAULT true,
  "telegram_chat_id" TEXT,
  "last_check_at" TIMESTAMP(3),
  "last_error" TEXT,
  "last_new_count" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_radar_profile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "job_vacancies" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'hh',
  "external_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "company" TEXT,
  "company_url" TEXT,
  "url" TEXT NOT NULL,
  "salary_from" INTEGER,
  "salary_to" INTEGER,
  "salary_currency" TEXT,
  "salary_gross" BOOLEAN,
  "area" TEXT,
  "remote" BOOLEAN NOT NULL DEFAULT false,
  "employment" TEXT,
  "description" TEXT NOT NULL,
  "published_at" TIMESTAMP(3),
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "employer_trusted" BOOLEAN,
  "employer_vacancy_count" INTEGER,
  "match_score" INTEGER,
  "trust_score" INTEGER,
  "trust_checks" JSONB,
  "fit_reasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "why_fit" TEXT,
  "status" TEXT NOT NULL DEFAULT 'new',
  "notified_at" TIMESTAMP(3),
  "reply_draft" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_vacancies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "job_vacancies_source_external_id_key" ON "job_vacancies"("source", "external_id");
CREATE INDEX IF NOT EXISTS "job_vacancies_status_first_seen_at_idx" ON "job_vacancies"("status", "first_seen_at");
