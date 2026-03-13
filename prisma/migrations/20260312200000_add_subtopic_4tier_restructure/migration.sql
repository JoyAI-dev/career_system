-- CreateEnum
CREATE TYPE "TopicPreferenceMode" AS ENUM ('REPEAT', 'FILTER', 'CONTEXT');

-- CreateTable: sub_topics
CREATE TABLE "sub_topics" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "preferenceOptionId" TEXT,

    CONSTRAINT "sub_topics_pkey" PRIMARY KEY ("id")
);

-- Add new columns to topics
ALTER TABLE "topics" ADD COLUMN "preferenceMode" "TopicPreferenceMode" NOT NULL DEFAULT 'CONTEXT';
ALTER TABLE "topics" ADD COLUMN "showInReport" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "topics" ADD COLUMN "preferenceCategoryId" TEXT;

-- Migrate dimensions: add subTopicId column (nullable first, then fill, then make required)
ALTER TABLE "dimensions" ADD COLUMN "subTopicId" TEXT;

-- For existing data: create a SubTopic for each Topic, then link dimensions
-- This is a data migration: for each topic, create a default SubTopic and point dimensions to it
INSERT INTO "sub_topics" ("id", "topicId", "name", "order")
SELECT gen_random_uuid(), t."id", t."name", 1
FROM "topics" t;

-- Link existing dimensions to their SubTopics (via topic → sub_topic)
UPDATE "dimensions" d
SET "subTopicId" = st."id"
FROM "sub_topics" st
WHERE st."topicId" = d."topicId";

-- Now make subTopicId NOT NULL
ALTER TABLE "dimensions" ALTER COLUMN "subTopicId" SET NOT NULL;

-- Drop old topicId column from dimensions
ALTER TABLE "dimensions" DROP COLUMN "topicId";

-- Add preferenceOptionId to response_answers
ALTER TABLE "response_answers" ADD COLUMN "preferenceOptionId" TEXT;

-- Drop topicId from preference_categories (reverse direction change)
ALTER TABLE "preference_categories" DROP COLUMN "topicId";

-- CreateIndex
CREATE INDEX "sub_topics_topicId_idx" ON "sub_topics"("topicId");
CREATE INDEX "sub_topics_preferenceOptionId_idx" ON "sub_topics"("preferenceOptionId");
CREATE INDEX "dimensions_subTopicId_idx" ON "dimensions"("subTopicId");
CREATE INDEX "response_answers_preferenceOptionId_idx" ON "response_answers"("preferenceOptionId");

-- Add unique constraint for REPEAT mode answers
CREATE UNIQUE INDEX "response_answers_snapshotId_questionId_preferenceOptionId_key" ON "response_answers"("snapshotId", "questionId", "preferenceOptionId");

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_preferenceCategoryId_fkey" FOREIGN KEY ("preferenceCategoryId") REFERENCES "preference_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sub_topics" ADD CONSTRAINT "sub_topics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sub_topics" ADD CONSTRAINT "sub_topics_preferenceOptionId_fkey" FOREIGN KEY ("preferenceOptionId") REFERENCES "preference_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dimensions" ADD CONSTRAINT "dimensions_subTopicId_fkey" FOREIGN KEY ("subTopicId") REFERENCES "sub_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "response_answers" ADD CONSTRAINT "response_answers_preferenceOptionId_fkey" FOREIGN KEY ("preferenceOptionId") REFERENCES "preference_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
