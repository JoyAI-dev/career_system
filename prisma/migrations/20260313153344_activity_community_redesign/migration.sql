-- CreateEnum
CREATE TYPE "ActivityScope" AS ENUM ('GROUP_6', 'PAIR_2', 'CROSS_GROUP', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "CompletionMode" AS ENUM ('LEADER_ONLY', 'ALL_MEMBERS');

-- CreateEnum
CREATE TYPE "PairingMode" AS ENUM ('AUTO', 'SELF_SELECT', 'SELF_SELECT_WITH_LEADER');

-- CreateEnum
CREATE TYPE "PairingStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISSOLVED');

-- CreateEnum
CREATE TYPE "StandbyStatus" AS ENUM ('AVAILABLE', 'MATCHED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VirtualGroupStatus" AS ENUM ('FORMING', 'ACTIVE', 'COMPLETED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'GROUP_FORMED';
ALTER TYPE "NotificationType" ADD VALUE 'PAIRING_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'PAIRING_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE 'ACTIVITY_UNLOCKED';
ALTER TYPE "NotificationType" ADD VALUE 'ACTIVITY_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE 'STANDBY_MATCHED';

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "autoScheduledAt" TIMESTAMP(3),
ADD COLUMN     "communityId" TEXT,
ADD COLUMN     "competitorActivityId" TEXT,
ADD COLUMN     "virtualGroupId" TEXT,
ADD COLUMN     "winnerId" TEXT;

-- AlterTable
ALTER TABLE "activity_types" ADD COLUMN     "allowViewLocked" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "completionMode" "CompletionMode" NOT NULL DEFAULT 'LEADER_ONLY',
ADD COLUMN     "duration" TEXT,
ADD COLUMN     "guideContent" TEXT,
ADD COLUMN     "intervalHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "pairingMode" "PairingMode",
ADD COLUMN     "peopleRequired" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "scope" "ActivityScope" NOT NULL DEFAULT 'GROUP_6',
ADD COLUMN     "timeoutHours" INTEGER NOT NULL DEFAULT 24;

-- CreateTable
CREATE TABLE "virtual_groups" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "name" TEXT,
    "status" "VirtualGroupStatus" NOT NULL DEFAULT 'FORMING',
    "leaderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "virtual_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virtual_group_members" (
    "id" TEXT NOT NULL,
    "virtualGroupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "order" INTEGER NOT NULL,

    CONSTRAINT "virtual_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pairings" (
    "id" TEXT NOT NULL,
    "virtualGroupId" TEXT NOT NULL,
    "activityTypeId" TEXT NOT NULL,
    "activityId" TEXT,
    "user1Id" TEXT NOT NULL,
    "user2Id" TEXT NOT NULL,
    "status" "PairingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "pairings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standby_users" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "StandbyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "addedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedAt" TIMESTAMP(3),

    CONSTRAINT "standby_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_configs" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "morningCutoff" TEXT NOT NULL DEFAULT '10:00',
    "eveningCutoff" TEXT NOT NULL DEFAULT '17:00',
    "morningDelayHours" INTEGER NOT NULL DEFAULT 0,
    "eveningDelayHours" INTEGER NOT NULL DEFAULT 24,
    "defaultActivityTime" TEXT NOT NULL DEFAULT '09:00',
    "suggestedMorningStart" TEXT NOT NULL DEFAULT '09:00',
    "suggestedMorningEnd" TEXT NOT NULL DEFAULT '11:00',
    "suggestedAfternoonStart" TEXT NOT NULL DEFAULT '14:00',
    "suggestedAfternoonEnd" TEXT NOT NULL DEFAULT '16:00',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduling_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "virtual_groups_communityId_idx" ON "virtual_groups"("communityId");

-- CreateIndex
CREATE INDEX "virtual_group_members_userId_idx" ON "virtual_group_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "virtual_group_members_virtualGroupId_userId_key" ON "virtual_group_members"("virtualGroupId", "userId");

-- CreateIndex
CREATE INDEX "pairings_virtualGroupId_activityTypeId_idx" ON "pairings"("virtualGroupId", "activityTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "pairings_virtualGroupId_activityTypeId_user1Id_user2Id_key" ON "pairings"("virtualGroupId", "activityTypeId", "user1Id", "user2Id");

-- CreateIndex
CREATE UNIQUE INDEX "standby_users_userId_key" ON "standby_users"("userId");

-- CreateIndex
CREATE INDEX "standby_users_status_idx" ON "standby_users"("status");

-- CreateIndex
CREATE INDEX "activities_communityId_idx" ON "activities"("communityId");

-- CreateIndex
CREATE INDEX "activities_virtualGroupId_idx" ON "activities"("virtualGroupId");

-- CreateIndex
CREATE INDEX "activities_competitorActivityId_idx" ON "activities"("competitorActivityId");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_virtualGroupId_fkey" FOREIGN KEY ("virtualGroupId") REFERENCES "virtual_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_competitorActivityId_fkey" FOREIGN KEY ("competitorActivityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "virtual_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virtual_groups" ADD CONSTRAINT "virtual_groups_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virtual_groups" ADD CONSTRAINT "virtual_groups_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virtual_group_members" ADD CONSTRAINT "virtual_group_members_virtualGroupId_fkey" FOREIGN KEY ("virtualGroupId") REFERENCES "virtual_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virtual_group_members" ADD CONSTRAINT "virtual_group_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_virtualGroupId_fkey" FOREIGN KEY ("virtualGroupId") REFERENCES "virtual_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "activity_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standby_users" ADD CONSTRAINT "standby_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standby_users" ADD CONSTRAINT "standby_users_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
