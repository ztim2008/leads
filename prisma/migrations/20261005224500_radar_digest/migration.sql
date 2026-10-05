ALTER TABLE "job_radar_profile" ADD COLUMN IF NOT EXISTS "last_digest_at" TIMESTAMP(3);
ALTER TABLE "job_vacancies" ADD COLUMN IF NOT EXISTS "responses_count" INTEGER;
ALTER TABLE "job_vacancies" ADD COLUMN IF NOT EXISTS "hide_reason" TEXT;
