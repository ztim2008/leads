-- AlterTable
ALTER TABLE "sources" ADD COLUMN     "last_error" TEXT,
ADD COLUMN     "status" TEXT DEFAULT 'active';
