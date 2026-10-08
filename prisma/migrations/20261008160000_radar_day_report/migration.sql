ALTER TABLE "job_radar_profile" ADD COLUMN IF NOT EXISTS "last_morning_report_at" TIMESTAMP(3);
ALTER TABLE "job_radar_profile" ADD COLUMN IF NOT EXISTS "last_evening_report_at" TIMESTAMP(3);
ALTER TABLE "job_radar_profile" ADD COLUMN IF NOT EXISTS "digest_message_id" INTEGER;
ALTER TABLE "job_vacancies" ADD COLUMN IF NOT EXISTS "telegram_message_id" INTEGER;
