/**
 * Activity Matching Service
 *
 * Handles automatic matching of users into activities within their communities.
 * Called when:
 * 1. User completes questionnaire (first activity: roundtable)
 * 2. User completes an activity (advance to next activity type)
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { createNotification, createNotifications } from '@/server/notifications';
import { calculateScheduledTime, scheduleActivity } from './activityScheduling';
import {
  createVirtualGroup,
  addMemberToGroup,
  findFormingGroupInCommunity,
  getDefaultGroupSize,
  type PrismaTransactionClient,
} from './virtualGroup';
import { autoPairGroup } from './pairing';

/**
 * Called after a user completes the questionnaire.
 * Finds the user's communities and attempts to match them into the first activity (roundtable).
 *
 * Flow:
 * 1. Get user's community memberships
 * 2. Get the first activity type (order=0, roundtable)
 * 3. For each community the user belongs to:
 *    a. Check if there's a FORMING virtual group with space
 *    b. If yes, add user to it
 *    c. If no, create a new virtual group, make this user the leader
 *    d. If virtual group reaches 6 people, transition to ACTIVE and create the roundtable activity
 * 4. Send notifications
 */
export async function matchUserToFirstActivity(userId: string): Promise<void> {
  // 1. Get user's community memberships
  const communityMemberships = await prisma.communityMember.findMany({
    where: { userId },
    select: { communityId: true },
  });

  if (communityMemberships.length === 0) {
    return; // User has no communities, nothing to match
  }

  // 2. Get the first activity type (lowest order, which should be the roundtable)
  const firstActivityType = await prisma.activityType.findFirst({
    where: { isEnabled: true, prerequisiteTypeId: null },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      name: true,
      scope: true,
      peopleRequired: true,
      intervalHours: true,
    },
  });

  if (!firstActivityType) {
    return; // No activity types configured
  }

  // 3. For each community the user belongs to, try to match into a virtual group
  //    Each community matching is wrapped in a transaction with a FOR UPDATE lock
  //    on the community row to prevent race conditions (C1 fix).
  for (const { communityId } of communityMemberships) {
    await prisma.$transaction(async (tx) => {
      // Lock the community row to serialize concurrent matching for the same community
      await tx.$queryRaw`SELECT id FROM communities WHERE id = ${communityId} FOR UPDATE`;

      // Check if user is already in a virtual group for this community
      const existingGroupMembership = await tx.virtualGroupMember.findFirst({
        where: {
          userId,
          virtualGroup: { communityId },
        },
      });

      if (existingGroupMembership) {
        return; // User already in a group for this community
      }

      // a. Check if there's a FORMING virtual group with space
      const formingGroupId = await findFormingGroupInCommunity(communityId, tx);

      let groupId: string;

      if (formingGroupId) {
        // b. Add user to the existing forming group (pass tx to run within this transaction)
        groupId = formingGroupId;
        const { isFull, memberCount } = await addMemberToGroup(groupId, userId, tx);

        if (isFull) {
          // d. Group is now full -- create the roundtable activity
          await onGroupFormed(groupId, firstActivityType, communityId, tx);
        } else {
          // Notify user they've been added to a forming group
          await createNotification({
            userId,
            type: 'GROUP_FORMED',
            title: 'Joined a group',
            message: `You've been added to a forming group (${memberCount}/${getDefaultGroupSize()} members). Waiting for more members.`,
          }, tx);
        }
      } else {
        // c. Create a new virtual group, make this user the leader (pass tx)
        groupId = await createVirtualGroup(communityId, userId, tx);

        // Notify user they're the first member / leader candidate
        await createNotification({
          userId,
          type: 'GROUP_FORMED',
          title: 'Group created',
          message: `You're the first member of a new group. Waiting for ${getDefaultGroupSize() - 1} more members.`,
        }, tx);
      }
    });
  }
}

/**
 * Called when a virtual group reaches full capacity.
 * Creates the first activity (roundtable) and schedules it.
 *
 * @param tx Optional transaction client for running within an existing transaction.
 */
async function onGroupFormed(
  groupId: string,
  activityType: {
    id: string;
    name: string;
    scope: string;
    peopleRequired: number;
    intervalHours: number;
  },
  communityId: string,
  tx?: PrismaTransactionClient,
): Promise<void> {
  const db = tx ?? prisma;

  // Get all group members
  const members = await db.virtualGroupMember.findMany({
    where: { virtualGroupId: groupId },
    orderBy: { order: 'asc' },
    select: { userId: true, order: true },
  });

  // Get the group leader
  const group = await db.virtualGroup.findUnique({
    where: { id: groupId },
    select: { leaderId: true, name: true },
  });

  // Create the roundtable activity
  const activity = await db.activity.create({
    data: {
      typeId: activityType.id,
      title: `${activityType.name} - ${group?.name ?? 'Group'}`,
      capacity: activityType.peopleRequired,
      status: 'FULL',
      communityId,
      virtualGroupId: groupId,
      createdBy: group?.leaderId ?? members[0].userId,
    },
  });

  // Add all group members as activity members
  const membershipData = members.map((m) => ({
    activityId: activity.id,
    userId: m.userId,
    role: (m.userId === group?.leaderId ? 'LEADER' : 'MEMBER') as 'LEADER' | 'MEMBER',
  }));

  await db.membership.createMany({
    data: membershipData,
  });

  // Auto-schedule the activity (uses global prisma since scheduleActivity is lightweight)
  const scheduledTime = await calculateScheduledTime(new Date(), activityType.intervalHours);
  await scheduleActivity(activity.id, scheduledTime, tx);

  // Notify all members that the group is formed and activity is scheduled
  const notifications = members.map((m) => ({
    userId: m.userId,
    type: 'GROUP_FORMED' as const,
    title: 'Group formed!',
    message: `Your group is complete! The first activity "${activityType.name}" has been scheduled.`,
  }));

  await createNotifications(notifications, tx);
}

/**
 * Called after a user completes an activity.
 * Determines the next activity type and handles advancement.
 *
 * Flow:
 * 1. Find the next activity type in the chain (by prerequisiteTypeId)
 * 2. Check completion mode (I8): LEADER_ONLY vs ALL_MEMBERS
 * 3. Based on the next activity's scope:
 *    - GROUP_6: Auto-create activity for the user's virtual group
 *    - PAIR_2: Trigger pairing flow (create pairings based on pairing mode)
 *    - CROSS_GROUP: Register group for competition matching
 *    - INDIVIDUAL: Auto-create individual activity
 * 4. Auto-schedule based on intervalHours and scheduling config
 * 5. Send ACTIVITY_UNLOCKED notification
 *
 * Uses a transaction with FOR UPDATE lock on the virtual group row to prevent
 * race conditions when multiple members complete simultaneously (C2 fix).
 */
export async function advanceUserToNextActivity(
  userId: string,
  completedActivityTypeId: string,
): Promise<void> {
  // 1. Find the next activity type in the chain
  const nextType = await prisma.activityType.findFirst({
    where: {
      prerequisiteTypeId: completedActivityTypeId,
      isEnabled: true,
    },
    select: {
      id: true,
      name: true,
      scope: true,
      peopleRequired: true,
      intervalHours: true,
      pairingMode: true,
      completionMode: true,
    },
  });

  if (!nextType) {
    return; // No next activity type; this was the last one
  }

  // Get the user's virtual groups from the completed activity
  const completedActivity = await prisma.activity.findFirst({
    where: {
      typeId: completedActivityTypeId,
      memberships: { some: { userId, completedAt: { not: null } } },
    },
    select: {
      virtualGroupId: true,
      communityId: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!completedActivity?.virtualGroupId) {
    // No virtual group context -- send unlock notification only
    await createNotification({
      userId,
      type: 'ACTIVITY_UNLOCKED',
      title: 'New activity unlocked',
      message: `You've unlocked "${nextType.name}"!`,
    });
    return;
  }

  const { virtualGroupId, communityId } = completedActivity;

  // Send ACTIVITY_UNLOCKED notification to the user who just completed
  await createNotification({
    userId,
    type: 'ACTIVITY_UNLOCKED',
    title: 'New activity unlocked',
    message: `You've unlocked "${nextType.name}"!`,
  });

  // Wrap the "check completion + create next activity" in a transaction
  // with a FOR UPDATE lock on the virtual group to prevent race conditions (C2 fix).
  const shouldCreateActivity = await prisma.$transaction(async (tx) => {
    // Lock the virtual group row
    await tx.$queryRaw`SELECT id FROM virtual_groups WHERE id = ${virtualGroupId} FOR UPDATE`;

    // I8: Check completion mode enforcement
    const completedType = await tx.activityType.findUnique({
      where: { id: completedActivityTypeId },
      select: { completionMode: true },
    });

    const group = await tx.virtualGroup.findUnique({
      where: { id: virtualGroupId },
      select: { leaderId: true },
    });

    if (completedType?.completionMode === 'LEADER_ONLY') {
      // Only check if the leader has completed
      const leaderCompleted = await tx.membership.findFirst({
        where: {
          activity: { typeId: completedActivityTypeId, virtualGroupId },
          userId: group?.leaderId ?? '',
          completedAt: { not: null },
        },
      });
      if (!leaderCompleted) return false; // Leader hasn't completed yet
    } else {
      // ALL_MEMBERS mode: Check if all group members have completed
      const groupMembers = await tx.virtualGroupMember.findMany({
        where: { virtualGroupId },
        select: { userId: true },
      });

      const completedMembers = await tx.membership.findMany({
        where: {
          activity: {
            typeId: completedActivityTypeId,
            virtualGroupId,
          },
          completedAt: { not: null },
        },
        select: { userId: true },
      });
      const completedUserIds = new Set(completedMembers.map((m) => m.userId));

      const allMembersCompleted = groupMembers.every((m) => completedUserIds.has(m.userId));
      if (!allMembersCompleted) return false;
    }

    // Check if an activity for this type already exists for this group
    const existingActivity = await tx.activity.findFirst({
      where: {
        typeId: nextType.id,
        virtualGroupId,
      },
    });

    if (existingActivity) {
      return false; // Already created (possibly by another member completing simultaneously)
    }

    return true; // Safe to create the next activity
  });

  if (!shouldCreateActivity) {
    return;
  }

  // Get group members for activity creation (outside transaction since creation is idempotent-guarded above)
  const groupMembers = await prisma.virtualGroupMember.findMany({
    where: { virtualGroupId },
    select: { userId: true },
  });

  // 2. Create activity based on scope
  switch (nextType.scope) {
    case 'GROUP_6':
      await createGroupActivity(nextType, virtualGroupId, communityId, groupMembers);
      break;

    case 'PAIR_2':
      await initiatePairingFlow(nextType, virtualGroupId, communityId, groupMembers);
      break;

    case 'CROSS_GROUP':
      await registerForCrossGroupMatch(nextType, virtualGroupId, communityId, groupMembers);
      break;

    case 'INDIVIDUAL':
      await createIndividualActivities(nextType, virtualGroupId, communityId, groupMembers);
      break;
  }
}

/**
 * Create a GROUP_6 activity for the entire virtual group.
 */
async function createGroupActivity(
  activityType: {
    id: string;
    name: string;
    peopleRequired: number;
    intervalHours: number;
  },
  virtualGroupId: string,
  communityId: string | null,
  groupMembers: Array<{ userId: string }>,
): Promise<void> {
  const group = await prisma.virtualGroup.findUnique({
    where: { id: virtualGroupId },
    select: { leaderId: true, name: true },
  });

  const activity = await prisma.activity.create({
    data: {
      typeId: activityType.id,
      title: `${activityType.name} - ${group?.name ?? 'Group'}`,
      capacity: activityType.peopleRequired,
      status: 'FULL',
      communityId,
      virtualGroupId,
      createdBy: group?.leaderId ?? groupMembers[0].userId,
    },
  });

  // Add all group members
  await prisma.membership.createMany({
    data: groupMembers.map((m) => ({
      activityId: activity.id,
      userId: m.userId,
      role: (m.userId === group?.leaderId ? 'LEADER' : 'MEMBER') as 'LEADER' | 'MEMBER',
    })),
  });

  // Auto-schedule
  const scheduledTime = await calculateScheduledTime(new Date(), activityType.intervalHours);
  await scheduleActivity(activity.id, scheduledTime);

  // Notify all members
  await createNotifications(
    groupMembers.map((m) => ({
      userId: m.userId,
      type: 'ACTIVITY_SCHEDULED' as const,
      title: 'Activity scheduled',
      message: `"${activityType.name}" has been automatically scheduled for your group.`,
    })),
  );
}

/**
 * Initiate the pairing flow for a PAIR_2 activity type.
 * Based on pairing mode:
 * - AUTO: immediately pair and create activities
 * - SELF_SELECT / SELF_SELECT_WITH_LEADER: notify members to self-pair
 */
async function initiatePairingFlow(
  activityType: {
    id: string;
    name: string;
    peopleRequired: number;
    intervalHours: number;
    pairingMode: string | null;
  },
  virtualGroupId: string,
  communityId: string | null,
  groupMembers: Array<{ userId: string }>,
): Promise<void> {
  const pairingMode = activityType.pairingMode ?? 'AUTO';
  const group = await prisma.virtualGroup.findUnique({
    where: { id: virtualGroupId },
    select: { leaderId: true },
  });

  if (pairingMode === 'AUTO') {
    // Auto-pair immediately
    await autoPairGroup(
      virtualGroupId,
      activityType.id,
      group?.leaderId ?? groupMembers[0].userId,
    );
  } else {
    // Notify members that pairing is needed
    await createNotifications(
      groupMembers.map((m) => ({
        userId: m.userId,
        type: 'ACTIVITY_UNLOCKED' as const,
        title: 'Pairing needed',
        message: `"${activityType.name}" requires pairing. Please select your partner.`,
      })),
    );
  }
}

/**
 * Register a virtual group for cross-group competition matching.
 * Looks for another group in the same community waiting for a match.
 * If found, creates competition activities for both groups.
 * If not found, marks this group as waiting.
 *
 * Uses FOR UPDATE SKIP LOCKED to prevent two groups from both missing each other (I3 fix).
 */
async function registerForCrossGroupMatch(
  activityType: {
    id: string;
    name: string;
    peopleRequired: number;
    intervalHours: number;
  },
  virtualGroupId: string,
  communityId: string | null,
  groupMembers: Array<{ userId: string }>,
): Promise<void> {
  if (!communityId) return;

  // Use a transaction with FOR UPDATE SKIP LOCKED to prevent race conditions (I3 fix)
  const result = await prisma.$transaction(async (tx) => {
    // Try to find a waiting activity with row lock (SKIP LOCKED avoids deadlock)
    const waitingActivities = await tx.$queryRaw<
      { id: string; virtualGroupId: string | null }[]
    >`
      SELECT a.id, a."virtualGroupId"
      FROM activities a
      WHERE a."typeId" = ${activityType.id}
        AND a."communityId" = ${communityId}
        AND a."competitorActivityId" IS NULL
        AND a."virtualGroupId" != ${virtualGroupId}
        AND a.status IN ('OPEN', 'FULL', 'SCHEDULED')
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    const waitingActivity = waitingActivities.length > 0 ? waitingActivities[0] : null;

    const group = await tx.virtualGroup.findUnique({
      where: { id: virtualGroupId },
      select: { leaderId: true, name: true },
    });

    // Create activity for this group
    const newActivity = await tx.activity.create({
      data: {
        typeId: activityType.id,
        title: `${activityType.name} - ${group?.name ?? 'Group'}`,
        capacity: activityType.peopleRequired,
        status: 'FULL',
        communityId,
        virtualGroupId,
        createdBy: group?.leaderId ?? groupMembers[0].userId,
      },
    });

    // Add all group members
    await tx.membership.createMany({
      data: groupMembers.map((m) => ({
        activityId: newActivity.id,
        userId: m.userId,
        role: (m.userId === group?.leaderId ? 'LEADER' : 'MEMBER') as 'LEADER' | 'MEMBER',
      })),
    });

    if (waitingActivity) {
      // Match the two activities as competitors
      await tx.activity.update({
        where: { id: newActivity.id },
        data: { competitorActivityId: waitingActivity.id },
      });
      await tx.activity.update({
        where: { id: waitingActivity.id },
        data: { competitorActivityId: newActivity.id },
      });

      return { matched: true, newActivityId: newActivity.id, waitingActivity };
    }

    return { matched: false, newActivityId: newActivity.id, waitingActivity: null };
  });

  if (result.matched && result.waitingActivity) {
    // Schedule both activities
    const scheduledTime = await calculateScheduledTime(new Date(), activityType.intervalHours);
    await scheduleActivity(result.newActivityId, scheduledTime);
    await scheduleActivity(result.waitingActivity.id, scheduledTime);

    // Get opponent group members for notification
    const opponentMembers = await prisma.virtualGroupMember.findMany({
      where: { virtualGroupId: result.waitingActivity.virtualGroupId! },
      select: { userId: true },
    });

    // Notify both groups
    const allNotifications = [
      ...groupMembers.map((m) => ({
        userId: m.userId,
        type: 'ACTIVITY_SCHEDULED' as const,
        title: 'Competition matched!',
        message: `Your group has been matched for "${activityType.name}". The competition is scheduled!`,
      })),
      ...opponentMembers.map((m) => ({
        userId: m.userId,
        type: 'ACTIVITY_SCHEDULED' as const,
        title: 'Competition matched!',
        message: `An opponent has been found for "${activityType.name}". The competition is scheduled!`,
      })),
    ];

    await createNotifications(allNotifications);
  } else {
    // No opponent yet -- this group waits
    await createNotifications(
      groupMembers.map((m) => ({
        userId: m.userId,
        type: 'ACTIVITY_UNLOCKED' as const,
        title: 'Waiting for opponent',
        message: `Your group is registered for "${activityType.name}". Waiting for another group to match.`,
      })),
    );
  }
}

/**
 * Create individual activities for each member of a virtual group.
 * Uses a single transaction to batch all creations (I5 fix for N+1).
 */
async function createIndividualActivities(
  activityType: {
    id: string;
    name: string;
    peopleRequired: number;
    intervalHours: number;
  },
  virtualGroupId: string,
  communityId: string | null,
  groupMembers: Array<{ userId: string }>,
): Promise<void> {
  const scheduledTime = await calculateScheduledTime(new Date(), activityType.intervalHours);

  await prisma.$transaction(async (tx) => {
    for (const member of groupMembers) {
      const activity = await tx.activity.create({
        data: {
          typeId: activityType.id,
          title: `${activityType.name} - Individual`,
          capacity: 1,
          status: 'FULL',
          communityId,
          virtualGroupId,
          createdBy: member.userId,
        },
      });

      await tx.membership.create({
        data: {
          activityId: activity.id,
          userId: member.userId,
          role: 'LEADER',
        },
      });

      await scheduleActivity(activity.id, scheduledTime, tx);
    }
  });

  // Notify all members
  await createNotifications(
    groupMembers.map((m) => ({
      userId: m.userId,
      type: 'ACTIVITY_SCHEDULED' as const,
      title: 'Individual activity scheduled',
      message: `Your individual activity "${activityType.name}" has been scheduled.`,
    })),
  );
}

/**
 * Attempts to fill a virtual group using standby users when:
 * - A member exits a group
 * - Timeout is reached and group is not full
 */
export async function fillGroupWithStandby(virtualGroupId: string): Promise<void> {
  const group = await prisma.virtualGroup.findUnique({
    where: { id: virtualGroupId },
    include: {
      _count: { select: { members: true } },
      community: { select: { id: true } },
    },
  });

  if (!group || group.status !== 'FORMING') {
    return; // Group doesn't need filling
  }

  const spotsNeeded = getDefaultGroupSize() - group._count.members;
  if (spotsNeeded <= 0) {
    return; // Group is already full
  }

  // Find available standby users (not already in this community's groups)
  const existingGroupUserIds = await prisma.virtualGroupMember.findMany({
    where: { virtualGroup: { communityId: group.communityId } },
    select: { userId: true },
  });
  const existingUserIdSet = new Set(existingGroupUserIds.map((m) => m.userId));

  const availableStandby = await prisma.standbyUser.findMany({
    where: {
      status: 'AVAILABLE',
      userId: { notIn: [...existingUserIdSet] },
    },
    orderBy: { createdAt: 'asc' },
    take: spotsNeeded,
    select: { id: true, userId: true },
  });

  for (const standby of availableStandby) {
    try {
      const { isFull } = await addMemberToGroup(virtualGroupId, standby.userId);

      // Update standby status to MATCHED
      await prisma.standbyUser.update({
        where: { id: standby.id },
        data: { status: 'MATCHED', matchedAt: new Date() },
      });

      // Notify the standby user
      await createNotification({
        userId: standby.userId,
        type: 'STANDBY_MATCHED',
        title: 'You have been matched!',
        message: 'You have been placed into a group as a standby member.',
      });

      if (isFull) {
        // Group is now complete -- trigger formation
        const firstActivityType = await prisma.activityType.findFirst({
          where: { isEnabled: true, prerequisiteTypeId: null },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            scope: true,
            peopleRequired: true,
            intervalHours: true,
          },
        });

        if (firstActivityType) {
          await onGroupFormed(virtualGroupId, firstActivityType, group.communityId);
        }
        break; // Group is full, stop adding
      }
    } catch {
      // Skip this standby user if there's a conflict (e.g., already in a group)
      continue;
    }
  }
}

/**
 * Leader determination: first person or person_count % required_count == 1.
 * Used to decide if a member should be the leader candidate in a new sub-grouping.
 */
export function isLeaderCandidate(memberOrder: number, requiredCount: number): boolean {
  return memberOrder === 1 || memberOrder % requiredCount === 1;
}

/**
 * Set the winner of a cross-group competition (ML1).
 * Updates both the activity and its competitor activity with the winning group.
 */
export async function setCompetitionWinner(
  activityId: string,
  winnerGroupId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Update the main activity
    await tx.activity.update({
      where: { id: activityId },
      data: { winnerId: winnerGroupId },
    });

    // Also update the competitor activity
    const activity = await tx.activity.findUnique({
      where: { id: activityId },
      select: { competitorActivityId: true },
    });

    if (activity?.competitorActivityId) {
      await tx.activity.update({
        where: { id: activity.competitorActivityId },
        data: { winnerId: winnerGroupId },
      });
    }
  });
}
