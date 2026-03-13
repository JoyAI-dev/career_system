-- AlterTable: Add hierarchicalMatchLevel to PreferenceCategory
ALTER TABLE "preference_categories" ADD COLUMN     "hierarchicalMatchLevel" TEXT;

-- AlterTable: Add lastActiveAt to User
ALTER TABLE "users" ADD COLUMN     "lastActiveAt" TIMESTAMP(3);

-- CreateTable: Community
CREATE TABLE "communities" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CommunityTag
CREATE TABLE "community_tags" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "community_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CommunityMember
CREATE TABLE "community_members" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "communities_fingerprint_key" ON "communities"("fingerprint");

-- CreateIndex
CREATE INDEX "communities_memberCount_idx" ON "communities"("memberCount" DESC);

-- CreateIndex
CREATE INDEX "community_tags_categoryId_optionId_idx" ON "community_tags"("categoryId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "community_tags_communityId_categoryId_key" ON "community_tags"("communityId", "categoryId");

-- CreateIndex
CREATE INDEX "community_members_userId_idx" ON "community_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "community_members_communityId_userId_key" ON "community_members"("communityId", "userId");

-- AddForeignKey
ALTER TABLE "community_tags" ADD CONSTRAINT "community_tags_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_tags" ADD CONSTRAINT "community_tags_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "preference_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_tags" ADD CONSTRAINT "community_tags_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "preference_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: Set hierarchicalMatchLevel for existing HIERARCHICAL_MULTI grouping categories
UPDATE "preference_categories"
SET "hierarchicalMatchLevel" = 'PARENT'
WHERE "inputType" = 'HIERARCHICAL_MULTI' AND "isGroupingBasis" = true;
