/**
 * Virtual Group Queries
 * Used by server components to fetch data for rendering.
 */

import { prisma } from '@/lib/db';

/** Get all virtual groups in a community with member details */
export async function getCommunityVirtualGroups(communityId: string) {
  return prisma.virtualGroup.findMany({
    where: { communityId },
    include: {
      leader: { select: { id: true, name: true, username: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, username: true } },
        },
        orderBy: { order: 'asc' },
      },
      activities: {
        include: {
          type: { select: { id: true, name: true, scope: true } },
          memberships: { select: { userId: true, completedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/** Get a user's virtual group in a specific community */
export async function getUserGroupInCommunity(
  userId: string,
  communityId: string,
) {
  const membership = await prisma.virtualGroupMember.findFirst({
    where: {
      userId,
      virtualGroup: { communityId },
    },
    include: {
      virtualGroup: {
        include: {
          leader: { select: { id: true, name: true, username: true } },
          members: {
            include: {
              user: { select: { id: true, name: true, username: true } },
            },
            orderBy: { order: 'asc' },
          },
          community: true,
        },
      },
    },
  });
  return membership?.virtualGroup ?? null;
}

/** Get activities for a virtual group with member status */
export async function getGroupActivities(virtualGroupId: string) {
  return prisma.activity.findMany({
    where: { virtualGroupId },
    include: {
      type: true,
      memberships: {
        include: {
          user: { select: { id: true, name: true, username: true } },
        },
      },
      pairings: {
        include: {
          user1: { select: { id: true, name: true, username: true } },
          user2: { select: { id: true, name: true, username: true } },
        },
      },
    },
    orderBy: [{ type: { order: 'asc' } }, { createdAt: 'asc' }],
  });
}

/** Get user's activity progress across all types */
export async function getUserActivityProgress(userId: string) {
  // Get all activity types
  const types = await prisma.activityType.findMany({
    where: { isEnabled: true },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      name: true,
      order: true,
      scope: true,
      peopleRequired: true,
      completionMode: true,
      prerequisiteTypeId: true,
    },
  });

  // Get user's completions
  const completions = await prisma.membership.findMany({
    where: { userId, completedAt: { not: null } },
    select: {
      activity: {
        select: { typeId: true },
      },
      completedAt: true,
    },
  });

  const completedTypeIds = new Set(completions.map((c) => c.activity.typeId));

  return types.map((type) => ({
    ...type,
    status: completedTypeIds.has(type.id)
      ? ('completed' as const)
      : type.prerequisiteTypeId === null ||
          completedTypeIds.has(type.prerequisiteTypeId)
        ? ('current' as const)
        : ('locked' as const),
  }));
}

/** Get pending pairing requests for a user */
export async function getUserPendingPairings(userId: string) {
  return prisma.pairing.findMany({
    where: {
      status: 'PENDING',
      OR: [{ user1Id: userId }, { user2Id: userId }],
    },
    include: {
      activityType: { select: { name: true } },
      user1: { select: { id: true, name: true, username: true } },
      user2: { select: { id: true, name: true, username: true } },
      virtualGroup: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
