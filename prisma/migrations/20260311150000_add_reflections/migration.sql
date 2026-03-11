-- CreateTable
CREATE TABLE "reflections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "activityTag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reflections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reflections_questionId_userId_idx" ON "reflections"("questionId", "userId");

-- AddForeignKey
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
