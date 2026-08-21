-- CRM + sales role (applied via prisma db push 2026-08-21)
-- Keep for git history; shadow migrate may be skipped on this host.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "login_enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "crm_clients" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "niche" TEXT,
  "city" TEXT,
  "status" TEXT NOT NULL DEFAULT 'lead',
  "lead_source" TEXT,
  "notes" TEXT,
  "next_step" TEXT,
  "next_step_at" TIMESTAMP(3),
  "owner_id" TEXT,
  "created_by_id" TEXT,
  "linked_workspace_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crm_contacts" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "label" TEXT,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_clients_linked_workspace_id_key" ON "crm_clients"("linked_workspace_id");
CREATE INDEX IF NOT EXISTS "crm_clients_status_idx" ON "crm_clients"("status");
CREATE INDEX IF NOT EXISTS "crm_clients_owner_id_idx" ON "crm_clients"("owner_id");
CREATE INDEX IF NOT EXISTS "crm_contacts_client_id_idx" ON "crm_contacts"("client_id");
