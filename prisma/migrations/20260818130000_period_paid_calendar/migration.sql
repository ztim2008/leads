-- Current period paid flag + payment calendar invoices
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "period_paid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "period_paid_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "billing_invoices" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "amount_rub" INTEGER NOT NULL,
  "paid" BOOLEAN NOT NULL DEFAULT false,
  "paid_at" TIMESTAMP(3),
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_invoices_workspace_id_period_start_key"
  ON "billing_invoices"("workspace_id", "period_start");

CREATE INDEX IF NOT EXISTS "billing_invoices_workspace_id_period_start_idx"
  ON "billing_invoices"("workspace_id", "period_start");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billing_invoices_workspace_id_fkey'
  ) THEN
    ALTER TABLE "billing_invoices"
      ADD CONSTRAINT "billing_invoices_workspace_id_fkey"
      FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
