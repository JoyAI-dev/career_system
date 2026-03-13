/**
 * Virtual Group Service
 *
 * Manages the lifecycle of virtual groups formed during roundtable matching.
 * A virtual group is the persistent 6-person team that stays together through all activities.
 *
 * INVARIANT (from schema): A user can only be in one VirtualGroup per Community.
 */

import { prisma } from '@/lib/db';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { VirtualGroupStatus } from '@prisma/client';

/** Transaction client type for passing into service functions */
export type PrismaTransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/** Default group size for roundtable activities */
const DEFAULT_GROUP_SIZE = 6;

/**
 * Create a new virtual group in a community.
 * The first member becomes the leader.
 *
 * @param tx Optional transaction client for running within an existing transaction.
 * @returns The ID of the newly created virtual group.
 */
export async function createVirtualGroup(
  communityId: string,
  firstUserId: string,
  tx?: PrismaTransactionClient,
): Promise<string> {
  const db = tx ?? prisma;

  // Check the invariant: user should not already be in a group for this community
  const existingMembership = await db.virtualGroupMember.findFirst({
    where: {
      userId: firstUserId,
      virtualGroup: { communityId },
    },
  });
  if (existingMembership) {
    throw new Error(
      `User ${firstUserId} is already in a virtual group for community ${communityId}`,
    );
  }

  // Count existing groups in this community for naming
  const groupCount = await db.virtualGroup.count({ where: { communityId } });

  const group = await db.virtualGroup.create({
    data: {
      communityId,
      name: `Group ${groupCount + 1}`,
      status: 'FORMING',
      leaderId: firstUserId,
      members: {
        create: {
          userId: firstUserId,
          order: 1,
        },
      },
    },
  });

  return group.id;
}

/**
 * Add a member to an existing virtual group.
 * Returns whether the group is now full (reached DEFAULT_GROUP_SIZE) and the current member count.
 *
 * Uses a transaction with FOR UPDATE lock to prevent race conditions when
 * multiple users are added concurrently (C1+C3 fix).
 *
 * @param tx Optional transaction client; if provided, runs within an existing transaction.
 */
export async function addMemberToGroup(
  groupId: string,
  userId: string,
  tx?: PrismaTransactionClient,
): Promise<{ isFull: boolean; memberCount: number }> {
  const runner = async (db: PrismaTransactionClient) => {
    // Lock the virtual group row to prevent concurrent modifications
    await db.$queryRaw`SELECT id FROM virtual_groups WHERE id = ${groupId} FOR UPDATE`;

    // Check the invariant: user should not already be in a group for this community
    const group = await db.virtualGroup.findUniqueOrThrow({
      where: { id: groupId },
      include: { community: true },
    });

    const existingMembership = await db.virtualGroupMember.findFirst({
      where: {
        userId,
        virtualGroup: { communityId: group.communityId },
      },
    });
    if (existingMembership) {
      throw new Error('User is already in a virtual group for this community');
    }

    // Get current member count (within the lock scope)
    const currentCount = await db.virtualGroupMember.count({
      where: { virtualGroupId: groupId },
    });

    if (currentCount >= DEFAULT_GROUP_SIZE) {
      throw new Error('Virtual group is already full');
    }

    // Add member with next order number
    await db.virtualGroupMember.create({
      data: {
        virtualGroupId: groupId,
        userId,
        order: currentCount + 1,
      },
    });

    const newCount = currentCount + 1;

    // If group now has DEFAULT_GROUP_SIZE members, transition to ACTIVE
    if (newCount >= DEFAULT_GROUP_SIZE) {
      await db.virtualGroup.update({
        where: { id: groupId },
        data: { status: 'ACTIVE' },
      });
    }

    return { isFull: newCount >= DEFAULT_GROUP_SIZE, memberCount: newCount };
  };

  // If a transaction client is passed, run within it; otherwise create a new transaction
  if (tx) {
    return runner(tx);
  }
  return prisma.$transaction(runner);
}

/**
 * Remove a member from a virtual group.
 * If the leader leaves, reassign leadership to the next member by order.
 * If the group becomes empty, mark it as FORMING.
 */
export async function removeMemberFromGroup(groupId: string, userId: string): Promise<void> {
  const group = await prisma.virtualGroup.findUnique({
    where: { id: groupId },
    select: { leaderId: true, status: true },
  });
  if (!group) {
    throw new Error(`Virtual group ${groupId} not found`);
  }

  // Remove the membership
  await prisma.virtualGroupMember.deleteMany({
    where: { virtualGroupId: groupId, userId },
  });

  // Count remaining members
  const remainingCount = await prisma.virtualGroupMember.count({
    where: { virtualGroupId: groupId },
  });

  if (remainingCount === 0) {
    // Group is empty, keep it but set to FORMING with no leader
    await prisma.virtualGroup.update({
      where: { id: groupId },
      data: { status: 'FORMING', leaderId: null },
    });
    return;
  }

  // If the leaving user was the leader, reassign to the next member by order
  if (group.leaderId === userId) {
    const nextLeader = await prisma.virtualGroupMember.findFirst({
      where: { virtualGroupId: groupId },
      orderBy: { order: 'asc' },
      select: { userId: true },
    });

    if (nextLeader) {
      await prisma.virtualGroup.update({
        where: { id: groupId },
        data: { leaderId: nextLeader.userId },
      });
    }
  }

  // If group was ACTIVE and now below capacity, revert to FORMING
  if (group.status === 'ACTIVE' && remainingCount < DEFAULT_GROUP_SIZE) {
    await prisma.virtualGroup.update({
      where: { id: groupId },
      data: { status: 'FORMING' },
    });
  }
}

/**
 * Get virtual group details including all members, leader, community, and activities.
 */
export async function getVirtualGroupDetails(groupId: string) {
  return prisma.virtualGroup.findUnique({
    where: { id: groupId },
    include: {
      community: { select: { id: true, name: true, fingerprint: true } },
      leader: { select: { id: true, name: true, username: true } },
      members: {
        orderBy: { order: 'asc' },
        include: {
          user: { select: { id: true, name: true, username: true } },
        },
      },
      activities: {
        orderBy: { createdAt: 'asc' },
        include: {
          type: { select: { id: true, name: true, scope: true } },
          _count: { select: { memberships: true } },
        },
      },
      pairings: {
        include: {
          activityType: { select: { id: true, name: true } },
          user1: { select: { id: true, name: true, username: true } },
          user2: { select: { id: true, name: true, username: true } },
        },
      },
    },
  });
}

/**
 * Find a FORMING virtual group in a community that has space (< DEFAULT_GROUP_SIZE members).
 * Returns the group ID or null if none found.
 *
 * @param tx Optional transaction client for running within an existing transaction.
 */
export async function findFormingGroupInCommunity(
  communityId: string,
  tx?: PrismaTransactionClient,
): Promise<string | null> {
  const db = tx ?? prisma;
  const groups = await db.virtualGroup.findMany({
    where: {
      communityId,
      status: 'FORMING',
    },
    include: {
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const group of groups) {
    if (group._count.members < DEFAULT_GROUP_SIZE) {
      return group.id;
    }
  }

  return null;
}

/**
 * Get all virtual groups a user belongs to, with details.
 */
export async function getUserVirtualGroups(userId: string) {
  const memberships = await prisma.virtualGroupMember.findMany({
    where: { userId },
    include: {
      virtualGroup: {
        include: {
          community: { select: { id: true, name: true } },
          leader: { select: { id: true, name: true, username: true } },
          members: {
            orderBy: { order: 'asc' },
            include: {
              user: { select: { id: true, name: true, username: true } },
            },
          },
          _count: { select: { members: true, activities: true } },
        },
      },
    },
  });

  return memberships.map((m) => m.virtualGroup);
}

/**
 * Get the member count for a virtual group.
 */
export async function getGroupMemberCount(groupId: string): Promise<number> {
  return prisma.virtualGroupMember.count({ where: { virtualGroupId: groupId } });
}

/**
 * Get the default group size constant.
 */
export function getDefaultGroupSize(): number {
  return DEFAULT_GROUP_SIZE;
}
