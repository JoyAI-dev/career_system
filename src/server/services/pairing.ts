/**
 * Pairing Service
 *
 * Manages pairing of users within virtual groups for activities requiring 2 people.
 * Supports three modes:
 * - AUTO: System randomly pairs users
 * - SELF_SELECT: Users choose their own partner
 * - SELF_SELECT_WITH_LEADER: Users choose, leader can pair remaining
 *
 * INVARIANT (from schema): user1Id < user2Id (lexicographic ordering)
 * to prevent duplicate pairings.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type { PairingStatus } from '@prisma/client';
import { createNotification, createNotifications } from '@/server/notifications';
import { calculateScheduledTime, scheduleActivity } from './activityScheduling';

/**
 * Enforce the ordering invariant: user1Id < user2Id (lexicographic).
 */
function orderUserIds(idA: string, idB: string): { user1Id: string; user2Id: string } {
  if (idA < idB) {
    return { user1Id: idA, user2Id: idB };
  }
  return { user1Id: idB, user2Id: idA };
}

/**
 * Create a pairing request between two users.
 * Enforces user1Id < user2Id ordering (INVARIANT from schema review).
 *
 * Uses a transaction with FOR UPDATE lock on the virtual group row to prevent
 * race conditions when two users try to pair simultaneously (C4 fix).
 *
 * @returns The pairing ID.
 */
export async function createPairing(
  virtualGroupId: string,
  activityTypeId: string,
  requesterId: string,
  partnerId: string,
  createdById: string,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    // Lock the virtual group row to serialize concurrent pairing attempts (C4 fix)
    await tx.$queryRaw`SELECT id FROM virtual_groups WHERE id = ${virtualGroupId} FOR UPDATE`;

    // 1. Enforce ordering
    const { user1Id, user2Id } = orderUserIds(requesterId, partnerId);

    // 2. Check neither user is already paired for this activity type in this group
    const existingPairing = await tx.pairing.findFirst({
      where: {
        virtualGroupId,
        activityTypeId,
        status: { in: ['PENDING', 'ACCEPTED'] },
        OR: [
          { user1Id: requesterId },
          { user2Id: requesterId },
          { user1Id: partnerId },
          { user2Id: partnerId },
        ],
      },
    });

    if (existingPairing) {
      throw new Error('One or both users are already paired for this activity type in this group.');
    }

    // 3. Verify both users are members of the virtual group
    const memberCount = await tx.virtualGroupMember.count({
      where: {
        virtualGroupId,
        userId: { in: [requesterId, partnerId] },
      },
    });

    if (memberCount !== 2) {
      throw new Error('Both users must be members of the virtual group.');
    }

    // 4. Create pairing with status PENDING
    const pairing = await tx.pairing.create({
      data: {
        virtualGroupId,
        activityTypeId,
        user1Id,
        user2Id,
        status: 'PENDING',
        createdById,
      },
    });

    // 5. Send PAIRING_REQUEST notification to the partner
    const partnerUserId = requesterId === createdById ? partnerId : requesterId;
    await createNotification({
      userId: partnerUserId,
      type: 'PAIRING_REQUEST',
      title: 'Pairing request',
      message: 'Someone wants to pair with you for an upcoming activity. Please confirm or decline.',
    }, tx);

    return pairing.id;
  });
}

/**
 * Accept a pairing request.
 * If all members in the group are now paired, auto-create activities for each pair.
 */
export async function acceptPairing(pairingId: string, userId: string): Promise<void> {
  const pairing = await prisma.pairing.findUnique({
    where: { id: pairingId },
    include: {
      activityType: {
        select: { id: true, name: true, peopleRequired: true, intervalHours: true },
      },
      virtualGroup: {
        select: { id: true, communityId: true, leaderId: true, name: true },
      },
    },
  });

  if (!pairing) {
    throw new Error('Pairing not found.');
  }

  // 1. Verify user is part of this pairing
  if (pairing.user1Id !== userId && pairing.user2Id !== userId) {
    throw new Error('You are not part of this pairing.');
  }

  if (pairing.status !== 'PENDING') {
    throw new Error(`Cannot accept pairing with status ${pairing.status}.`);
  }

  // 2. Set status to ACCEPTED
  await prisma.pairing.update({
    where: { id: pairingId },
    data: { status: 'ACCEPTED' },
  });

  // 3. Send PAIRING_CONFIRMED notification to the other user
  const otherUserId = pairing.user1Id === userId ? pairing.user2Id : pairing.user1Id;
  await createNotification({
    userId: otherUserId,
    type: 'PAIRING_CONFIRMED',
    title: 'Pairing confirmed',
    message: `Your pairing for "${pairing.activityType.name}" has been confirmed!`,
  });

  // 4. Check if all members in the group are paired
  const allPaired = await isGroupFullyPaired(
    pairing.virtualGroupId,
    pairing.activityTypeId,
  );

  if (allPaired) {
    // 5. Create activities for each accepted pair
    await createActivitiesForPairs(
      pairing.virtualGroupId,
      pairing.activityTypeId,
      pairing.activityType,
      pairing.virtualGroup,
    );
  }
}

/**
 * Dissolve a pairing (leader action).
 * Removes the pairing and any linked activity that hasn't started.
 */
export async function dissolvePairing(pairingId: string, leaderId: string): Promise<void> {
  const pairing = await prisma.pairing.findUnique({
    where: { id: pairingId },
    include: {
      virtualGroup: { select: { leaderId: true } },
      activity: { select: { id: true, status: true } },
    },
  });

  if (!pairing) {
    throw new Error('Pairing not found.');
  }

  // 1. Verify the requester is the group leader
  if (pairing.virtualGroup.leaderId !== leaderId) {
    throw new Error('Only the group leader can dissolve pairings.');
  }

  // 2. Set status to DISSOLVED
  await prisma.pairing.update({
    where: { id: pairingId },
    data: { status: 'DISSOLVED' },
  });

  // 3. Delete any linked activity if not yet started
  if (pairing.activity && pairing.activity.status !== 'IN_PROGRESS' && pairing.activity.status !== 'COMPLETED') {
    // Remove memberships first (cascade should handle this, but be explicit)
    await prisma.membership.deleteMany({
      where: { activityId: pairing.activity.id },
    });
    await prisma.activity.delete({
      where: { id: pairing.activity.id },
    });
  }

  // 4. Notify both users (I4 fix: use PAIRING_REQUEST instead of PAIRING_CONFIRMED for dissolution)
  const activityType = await prisma.activityType.findFirst({
    where: {
      pairings: { some: { id: pairingId } },
    },
    select: { name: true },
  });

  await createNotifications([
    {
      userId: pairing.user1Id,
      type: 'PAIRING_REQUEST',
      title: '配对已解除',
      message: activityType
        ? `组长解除了你在「${activityType.name}」中的配对`
        : '你的配对已被组长解除',
    },
    {
      userId: pairing.user2Id,
      type: 'PAIRING_REQUEST',
      title: '配对已解除',
      message: activityType
        ? `组长解除了你在「${activityType.name}」中的配对`
        : '你的配对已被组长解除',
    },
  ]);
}

/**
 * Auto-pair all unpaired members in a group for a given activity type.
 * Used when leader clicks "auto-pair remaining" or when pairing mode is AUTO.
 *
 * Creates pairings with status ACCEPTED (auto-accepted) and then creates activities.
 */
export async function autoPairGroup(
  virtualGroupId: string,
  activityTypeId: string,
  initiatorId: string,
): Promise<void> {
  // 1. Get all group members
  const allMembers = await prisma.virtualGroupMember.findMany({
    where: { virtualGroupId },
    orderBy: { order: 'asc' },
    select: { userId: true },
  });

  // 2. Get already paired members (PENDING or ACCEPTED)
  const existingPairings = await prisma.pairing.findMany({
    where: {
      virtualGroupId,
      activityTypeId,
      status: { in: ['PENDING', 'ACCEPTED'] },
    },
    select: { user1Id: true, user2Id: true },
  });

  const pairedUserIds = new Set<string>();
  for (const p of existingPairings) {
    pairedUserIds.add(p.user1Id);
    pairedUserIds.add(p.user2Id);
  }

  // 3. Get unpaired members
  const unpairedMembers = allMembers.filter((m) => !pairedUserIds.has(m.userId));

  if (unpairedMembers.length < 2) {
    return; // Not enough unpaired members to create a pair
  }

  // 4. Shuffle unpaired members randomly
  const shuffled = [...unpairedMembers];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 5. Pair them two by two, creating ACCEPTED pairings
  const newPairings: Array<{
    user1Id: string;
    user2Id: string;
  }> = [];

  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    const { user1Id, user2Id } = orderUserIds(shuffled[i].userId, shuffled[i + 1].userId);

    await prisma.pairing.create({
      data: {
        virtualGroupId,
        activityTypeId,
        user1Id,
        user2Id,
        status: 'ACCEPTED',
        createdById: initiatorId,
      },
    });

    newPairings.push({ user1Id, user2Id });
  }

  // 6. ML4: Handle odd-numbered groups - notify the unpaired person
  if (shuffled.length % 2 === 1) {
    const lastPerson = shuffled[shuffled.length - 1];
    await createNotification({
      userId: lastPerson.userId,
      type: 'PAIRING_REQUEST',
      title: '等待配对',
      message: '你的小组有奇数成员，请等待候补人员加入后完成配对',
    });
  }

  // 7. I7: Batch all notifications into a single call instead of one per pair
  const allPairNotifications = newPairings.flatMap((pair) => [
    {
      userId: pair.user1Id,
      type: 'PAIRING_CONFIRMED' as const,
      title: 'Auto-paired',
      message: 'You have been automatically paired for an upcoming activity.',
    },
    {
      userId: pair.user2Id,
      type: 'PAIRING_CONFIRMED' as const,
      title: 'Auto-paired',
      message: 'You have been automatically paired for an upcoming activity.',
    },
  ]);

  if (allPairNotifications.length > 0) {
    await createNotifications(allPairNotifications);
  }

  // 8. Check if all members are now paired and create activities
  const allPaired = await isGroupFullyPaired(virtualGroupId, activityTypeId);
  if (allPaired) {
    const activityType = await prisma.activityType.findUnique({
      where: { id: activityTypeId },
      select: { id: true, name: true, peopleRequired: true, intervalHours: true },
    });
    const virtualGroup = await prisma.virtualGroup.findUnique({
      where: { id: virtualGroupId },
      select: { id: true, communityId: true, leaderId: true, name: true },
    });

    if (activityType && virtualGroup) {
      await createActivitiesForPairs(virtualGroupId, activityTypeId, activityType, virtualGroup);
    }
  }
}

/**
 * Get pairing status for a virtual group and activity type.
 * Returns all pairings with user details, status, and overall progress.
 */
export async function getGroupPairingStatus(virtualGroupId: string, activityTypeId: string) {
  const [pairings, totalMembers] = await Promise.all([
    prisma.pairing.findMany({
      where: { virtualGroupId, activityTypeId },
      include: {
        user1: { select: { id: true, name: true, username: true } },
        user2: { select: { id: true, name: true, username: true } },
        activity: { select: { id: true, status: true, scheduledAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.virtualGroupMember.count({ where: { virtualGroupId } }),
  ]);

  const pairedCount = pairings.filter((p) => p.status === 'ACCEPTED' || p.status === 'PENDING').length * 2;
  const activePairings = pairings.filter((p) => p.status !== 'DISSOLVED');

  return {
    pairings: activePairings,
    totalMembers,
    pairedCount: Math.min(pairedCount, totalMembers),
    isFullyPaired: pairedCount >= totalMembers,
  };
}

/**
 * Check if all members in a group are paired for a given activity type.
 */
export async function isGroupFullyPaired(
  virtualGroupId: string,
  activityTypeId: string,
): Promise<boolean> {
  const totalMembers = await prisma.virtualGroupMember.count({
    where: { virtualGroupId },
  });

  const acceptedPairings = await prisma.pairing.count({
    where: {
      virtualGroupId,
      activityTypeId,
      status: 'ACCEPTED',
    },
  });

  // Each pairing covers 2 members
  return acceptedPairings * 2 >= totalMembers;
}

/**
 * Create activities for all accepted pairs in a virtual group.
 * Internal helper called when all members are paired.
 */
async function createActivitiesForPairs(
  virtualGroupId: string,
  activityTypeId: string,
  activityType: { id: string; name: string; peopleRequired: number; intervalHours: number },
  virtualGroup: { id: string; communityId: string; leaderId: string | null; name: string | null },
): Promise<void> {
  const acceptedPairings = await prisma.pairing.findMany({
    where: {
      virtualGroupId,
      activityTypeId,
      status: 'ACCEPTED',
      activityId: null, // Only pairs without an activity yet
    },
    select: { id: true, user1Id: true, user2Id: true },
  });

  const scheduledTime = await calculateScheduledTime(new Date(), activityType.intervalHours);

  for (const pairing of acceptedPairings) {
    // Create activity for this pair
    const activity = await prisma.activity.create({
      data: {
        typeId: activityType.id,
        title: `${activityType.name} - Pair`,
        capacity: 2,
        status: 'FULL',
        communityId: virtualGroup.communityId,
        virtualGroupId,
        createdBy: pairing.user1Id,
      },
    });

    // Add both users as members (first user is leader)
    await prisma.membership.createMany({
      data: [
        { activityId: activity.id, userId: pairing.user1Id, role: 'LEADER' },
        { activityId: activity.id, userId: pairing.user2Id, role: 'MEMBER' },
      ],
    });

    // Link pairing to activity
    await prisma.pairing.update({
      where: { id: pairing.id },
      data: { activityId: activity.id },
    });

    // Schedule the activity
    await scheduleActivity(activity.id, scheduledTime);

    // Notify both users
    await createNotifications([
      {
        userId: pairing.user1Id,
        type: 'ACTIVITY_SCHEDULED',
        title: 'Pair activity scheduled',
        message: `Your paired activity "${activityType.name}" has been scheduled.`,
      },
      {
        userId: pairing.user2Id,
        type: 'ACTIVITY_SCHEDULED',
        title: 'Pair activity scheduled',
        message: `Your paired activity "${activityType.name}" has been scheduled.`,
      },
    ]);
  }
}
