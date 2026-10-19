CREATE TABLE "diagnost_audits" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "owner_token" TEXT NOT NULL,
    "ip_hash" TEXT,
    "url" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "business_hint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "stages" JSONB,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "overall" INTEGER,
    "ad_readiness" INTEGER,
    "prev_id" TEXT,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "diagnost_audits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "diagnost_audits_slug_key" ON "diagnost_audits"("slug");
CREATE INDEX "diagnost_audits_owner_token_created_at_idx" ON "diagnost_audits"("owner_token", "created_at");
CREATE INDEX "diagnost_audits_status_created_at_idx" ON "diagnost_audits"("status", "created_at");
CREATE INDEX "diagnost_audits_ip_hash_created_at_idx" ON "diagnost_audits"("ip_hash", "created_at");
CREATE INDEX "diagnost_audits_host_created_at_idx" ON "diagnost_audits"("host", "created_at");
