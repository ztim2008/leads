-- Monthly lead quota for partner billing
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "leads_per_month" INTEGER NOT NULL DEFAULT 500;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "leads_used_month" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "quota_period_start" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "collection_enabled" BOOLEAN NOT NULL DEFAULT true;
