-- CreateTable
CREATE TABLE "recruitment_info" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruitment_info_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recruitment_info_eventDate_idx" ON "recruitment_info"("eventDate");

-- AddForeignKey
ALTER TABLE "recruitment_info" ADD CONSTRAINT "recruitment_info_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
