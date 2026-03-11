-- CreateTable
CREATE TABLE "response_comments" (
    "id" TEXT NOT NULL,
    "responseAnswerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "activityTag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "response_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "response_comments_responseAnswerId_idx" ON "response_comments"("responseAnswerId");

-- AddForeignKey
ALTER TABLE "response_comments" ADD CONSTRAINT "response_comments_responseAnswerId_fkey" FOREIGN KEY ("responseAnswerId") REFERENCES "response_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_comments" ADD CONSTRAINT "response_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
