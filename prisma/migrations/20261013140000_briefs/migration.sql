-- Стратег: брифы продвижения и whitelist директолога. Job Radar не затрагивается.

ALTER TABLE "app_config" ADD COLUMN IF NOT EXISTS "briefs_emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "brief_projects" (
  "id" TEXT NOT NULL,
  "site_url" TEXT NOT NULL,
  "region_name" TEXT NOT NULL,
  "niche" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "created_by_id" TEXT NOT NULL,
  "crm_client_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brief_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "brief_runs" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "error" TEXT,
  "pages" JSONB,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "brief_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "brief_findings" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "run_id" TEXT,
  "section" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "evidence_url" TEXT,
  "evidence_quote" TEXT,
  "sort" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brief_findings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "brief_documents" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "body" TEXT NOT NULL DEFAULT '',
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brief_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "brief_documents_project_id_key" ON "brief_documents"("project_id");
CREATE INDEX IF NOT EXISTS "brief_projects_created_by_id_idx" ON "brief_projects"("created_by_id");
CREATE INDEX IF NOT EXISTS "brief_projects_status_idx" ON "brief_projects"("status");
CREATE INDEX IF NOT EXISTS "brief_projects_crm_client_id_idx" ON "brief_projects"("crm_client_id");
CREATE INDEX IF NOT EXISTS "brief_runs_project_id_created_at_idx" ON "brief_runs"("project_id", "created_at");
CREATE INDEX IF NOT EXISTS "brief_runs_status_created_at_idx" ON "brief_runs"("status", "created_at");
CREATE INDEX IF NOT EXISTS "brief_findings_project_id_section_sort_idx" ON "brief_findings"("project_id", "section", "sort");

DO $$ BEGIN
  ALTER TABLE "brief_projects"
    ADD CONSTRAINT "brief_projects_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "brief_projects"
    ADD CONSTRAINT "brief_projects_crm_client_id_fkey"
    FOREIGN KEY ("crm_client_id") REFERENCES "crm_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "brief_runs"
    ADD CONSTRAINT "brief_runs_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "brief_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "brief_findings"
    ADD CONSTRAINT "brief_findings_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "brief_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "brief_documents"
    ADD CONSTRAINT "brief_documents_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "brief_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
