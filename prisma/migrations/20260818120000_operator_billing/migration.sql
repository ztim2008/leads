-- Operator billing: connection fee, VPS/day, monthly markup, pause/unlimited
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "connect_fee_rub" INTEGER NOT NULL DEFAULT 5000;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "vps_per_day_rub" INTEGER NOT NULL DEFAULT 40;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "month_markup_rub" INTEGER NOT NULL DEFAULT 1700;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "billing_mode" TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "period_start" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "paused_at" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "connect_fee_paid" BOOLEAN NOT NULL DEFAULT false;

UPDATE "subscriptions"
SET "period_start" = COALESCE("quota_period_start", "created_at")
WHERE "period_start" IS NULL;

-- Уже работающие партнёры: разовое подключение не показываем как долг
UPDATE "subscriptions" SET "connect_fee_paid" = true;
