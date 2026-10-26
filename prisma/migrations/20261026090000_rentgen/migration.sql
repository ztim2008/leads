CREATE TABLE "rentgen_scans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "owner_token" TEXT NOT NULL,
    "ip_hash" TEXT,
    "url" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rentgen_scans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "rentgen_scans_slug_key" ON "rentgen_scans"("slug");
CREATE INDEX "rentgen_scans_status_created_at_idx" ON "rentgen_scans"("status", "created_at");
CREATE INDEX "rentgen_scans_ip_hash_created_at_idx" ON "rentgen_scans"("ip_hash", "created_at");
CREATE INDEX "rentgen_scans_host_created_at_idx" ON "rentgen_scans"("host", "created_at");
