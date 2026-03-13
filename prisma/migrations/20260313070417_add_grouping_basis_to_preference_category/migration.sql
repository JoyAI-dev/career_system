-- AlterTable
ALTER TABLE "preference_categories" ADD COLUMN     "isGroupingBasis" BOOLEAN NOT NULL DEFAULT false;

-- Set grouping basis for first 6 categories
UPDATE "preference_categories" SET "isGroupingBasis" = true WHERE "order" <= 6;
