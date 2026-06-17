-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "system_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "work_days" TEXT DEFAULT '1,2,3,4,5',
ADD COLUMN     "work_hours_end" TEXT,
ADD COLUMN     "work_hours_start" TEXT;
