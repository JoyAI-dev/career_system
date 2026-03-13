/**
 * Standby User Service
 *
 * Manages standby (candidates) users who can bypass community restrictions
 * to fill vacant spots in activities/groups.
 *
 * Standby users are added by admins and can be automatically matched to
 * FORMING virtual groups that need more members to reach full capacity.
 */

import { prisma } from '@/lib/db';
import type { StandbyStatus } from '@prisma/client';
import { createNotification } from '@/server/notifications';
import { addMemberToGroup, getDefaultGroupSize } from './virtualGroup';
import { fillGroupWithStandby } from './activityMatching';

/**
 * Add a user as standby (admin action).
 * If the user already has a standby entry, update it to AVAILABLE.
 */
export async function addStandbyUser(
  userId: string,
  adminId: string,
  note?: string,
): Promise<void> {
  await prisma.standbyUser.upsert({
    where: { userId },
    update: { status: 'AVAILABLE', addedById: adminId, note: note ?? null, matchedAt: null },
    create: { userId, addedById: adminId, note: note ?? null, status: 'AVAILABLE' },
  });
}

/**
 * Remove standby status (admin action).
 * Sets the user's standby status to INACTIVE.
 */
export async function removeStandbyUser(userId: string): Promise<void> {
  const existing = await prisma.standbyUser.findUnique({ where: { userId } });
  if (!existing) {
    throw new Error(`User ${userId} is not a standby user.`);
  }

  await prisma.standbyUser.update({
    where: { userId },
    data: { status: 'INACTIVE' },
  });
}

/**
 * Get all available standby users with their user details.
 */
export async function getAvailableStandbyUsers() {
  return prisma.standbyUser.findMany({
    where: { status: 'AVAILABLE' },
    include: {
      user: {
        select: { id: true, name: true, username: true, school: true, major: true },
      },
      addedBy: {
        select: { id: true, name: true, username: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get all standby users (all statuses) for admin view.
 */
export async function getAllStandbyUsers() {
  return prisma.standbyUser.findMany({
    include: {
      user: {
        select: { id: true, name: true, username: true, school: true, major: true },
      },
      addedBy: {
        select: { id: true, name: true, username: true },
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
  });
}

/**
 * Match a standby user to a specific virtual group.
 * Updates standby status to MATCHED and adds them to the group.
 */
export async function matchStandbyToGroup(
  standbyUserId: string,
  virtualGroupId: string,
): Promise<void> {
  // 1. Get the standby user entry (by the standby record ID, not user ID)
  const standbyEntry = await prisma.standbyUser.findUnique({
    where: { userId: standbyUserId },
  });

  if (!standbyEntry) {
    throw new Error('Standby user not found.');
  }

  if (standbyEntry.status !== 'AVAILABLE') {
    throw new Error(`Standby user is not available (current status: ${standbyEntry.status}).`);
  }

  // 2. Add user to virtual group
  const { isFull } = await addMemberToGroup(virtualGroupId, standbyEntry.userId);

  // 3. Update standby status to MATCHED
  await prisma.standbyUser.update({
    where: { userId: standbyEntry.userId },
    data: { status: 'MATCHED', matchedAt: new Date() },
  });

  // 4. Send STANDBY_MATCHED notification
  await createNotification({
    userId: standbyEntry.userId,
    type: 'STANDBY_MATCHED',
    title: 'You have been matched!',
    message: 'You have been placed into a group. Check your activities for details.',
  });

  // 5. If group is now full, the addMemberToGroup already transitioned it to ACTIVE
  //    The caller (or fillGroupWithStandby) will handle creating the first activity.
}

/**
 * Check for virtual groups that have been waiting too long and need standby fill.
 * Looks for FORMING groups where createdAt + timeoutHours < now.
 *
 * This function can be called periodically (e.g., via a cron job) or triggered
 * on specific events (e.g., when a new standby user is added).
 */
export async function checkTimeoutAndFillStandby(): Promise<{
  checkedGroups: number;
  filledGroups: number;
}> {
  let checkedGroups = 0;
  let filledGroups = 0;

  // Get the default timeout from the first activity type (roundtable)
  const firstActivityType = await prisma.activityType.findFirst({
    where: { isEnabled: true, prerequisiteTypeId: null },
    orderBy: { order: 'asc' },
    select: { timeoutHours: true },
  });

  const timeoutHours = firstActivityType?.timeoutHours ?? 24;
  const cutoff = new Date(Date.now() - timeoutHours * 60 * 60 * 1000);

  // Find FORMING virtual groups that were created before the cutoff
  const staleGroups = await prisma.virtualGroup.findMany({
    where: {
      status: 'FORMING',
      createdAt: { lt: cutoff },
    },
    include: {
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const group of staleGroups) {
    checkedGroups++;
    const spotsNeeded = getDefaultGroupSize() - group._count.members;

    if (spotsNeeded <= 0) {
      continue; // Group is already at capacity but somehow still FORMING
    }

    // Try to fill with standby users
    const beforeCount = group._count.members;
    await fillGroupWithStandby(group.id);

    // Check if any standby users were added
    const afterCount = await prisma.virtualGroupMember.count({
      where: { virtualGroupId: group.id },
    });

    if (afterCount > beforeCount) {
      filledGroups++;
    }
  }

  return { checkedGroups, filledGroups };
}

/**
 * Get the standby status for a specific user.
 */
export async function getUserStandbyStatus(userId: string) {
  return prisma.standbyUser.findUnique({
    where: { userId },
    include: {
      addedBy: {
        select: { id: true, name: true, username: true },
      },
    },
  });
}
