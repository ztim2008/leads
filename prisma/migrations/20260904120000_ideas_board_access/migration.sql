-- Ideas Board MVP step 1: Idea / IdeaComment + AppConfig whitelist

ALTER TABLE "app_config" ADD COLUMN IF NOT EXISTS "ideas_board_emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "ideas" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_by_id" TEXT NOT NULL,
  "analysis" JSONB,
  "analyzed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "idea_comments" (
  "id" TEXT NOT NULL,
  "idea_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idea_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ideas_created_by_id_idx" ON "ideas"("created_by_id");
CREATE INDEX IF NOT EXISTS "ideas_status_idx" ON "ideas"("status");
CREATE INDEX IF NOT EXISTS "idea_comments_idea_id_idx" ON "idea_comments"("idea_id");
CREATE INDEX IF NOT EXISTS "idea_comments_author_id_idx" ON "idea_comments"("author_id");

DO $$ BEGIN
  ALTER TABLE "idea_comments"
    ADD CONSTRAINT "idea_comments_idea_id_fkey"
    FOREIGN KEY ("idea_id") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
