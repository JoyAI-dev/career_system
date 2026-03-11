-- AlterTable
ALTER TABLE "response_snapshots" ADD COLUMN "isSnapshot" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "response_snapshots" ADD COLUMN "snapshotLabel" TEXT;
