import { prisma } from '@/lib/db';
import { type ActivityStatus } from '@prisma/client';

export async function getActivities(status?: ActivityStatus) {
  return prisma.activity.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      type: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true, username: true } },
      activityTags: {
        include: { tag: { select: { id: true, name: true } } },
      },
      _count: { select: { memberships: true } },
    },
  });
}

export async function getActivityById(id: string) {
  return prisma.activity.findUnique({
    where: { id },
    include: {
      type: { select: { id: true, name: true } },
      activityTags: {
        include: { tag: { select: { id: true, name: true } } },
      },
      _count: { select: { memberships: true } },
    },
  });
}

/**
 * Get activity type IDs the user has unlocked via progressive completion.
 * A type is unlocked if it has no prerequisite, or the user has personally
 * finished (completedAt IS NOT NULL) an activity of the prerequisite type.
 */
export async function getUnlockedTypeIds(userId: string): Promise<Set<string>> {
  const types = await prisma.activityType.findMany({
    where: { isEnabled: true },
    orderBy: { order: 'asc' },
    select: { id: true, prerequisiteTypeId: true },
  });

  // Get type IDs where user has personally finished (completedAt set)
  const finishedMemberships = await prisma.membership.findMany({
    where: {
      userId,
      completedAt: { not: null },
    },
    select: { activity: { select: { typeId: true } } },
  });
  const finishedTypeIds = new Set(finishedMemberships.map((m) => m.activity.typeId));

  const unlocked = new Set<string>();
  for (const type of types) {
    if (!type.prerequisiteTypeId || finishedTypeIds.has(type.prerequisiteTypeId)) {
      unlocked.add(type.id);
    }
  }
  return unlocked;
}

/**
 * Get activities visible to a user with eligibility info.
 * Returns all non-completed activities with an `isEligible` flag.
 */
export async function getUserActivities(userId: string) {
  const [activities, unlockedTypeIds] = await Promise.all([
    prisma.activity.findMany({
      where: {
        status: { in: ['OPEN', 'FULL', 'SCHEDULED', 'IN_PROGRESS'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        type: { select: { id: true, name: true } },
        activityTags: {
          include: { tag: { select: { id: true, name: true } } },
        },
        memberships: {
          select: {
            userId: true,
            role: true,
            completedAt: true,
            user: { select: { username: true, name: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { memberships: true } },
      },
    }),
    getUnlockedTypeIds(userId),
  ]);

  return activities.map((activity) => {
    const userMembership = activity.memberships.find((m) => m.userId === userId) ?? null;
    const { memberships, ...rest } = activity;
    return {
      ...rest,
      isEligible: unlockedTypeIds.has(activity.typeId),
      isMember: !!userMembership,
      memberRole: userMembership?.role ?? undefined,
      memberCompletedAt: userMembership?.completedAt?.toISOString() ?? null,
      members: memberships.map((m) => ({
        username: m.user.username,
        name: m.user.name,
        role: m.role,
      })),
    };
  });
}

export type StepState = 'completed' | 'current' | 'locked';

export interface ActivityProgressStep {
  typeId: string;
  typeName: string;
  order: number;
  state: StepState;
}

/**
 * Get activity progress for the stepper component.
 * Returns ordered activity types with computed state (completed/current/locked).
 * A type is "completed" when the user has a membership with completedAt set
 * on any instance of that type.
 */
export async function getActivityProgress(userId: string): Promise<ActivityProgressStep[]> {
  const types = await prisma.activityType.findMany({
    where: { isEnabled: true },
    orderBy: { order: 'asc' },
    select: { id: true, name: true, order: true, prerequisiteTypeId: true },
  });

  // Use personal completedAt (not just activity status) for stepper state
  const finishedMemberships = await prisma.membership.findMany({
    where: {
      userId,
      completedAt: { not: null },
    },
    select: { activity: { select: { typeId: true } } },
  });
  const finishedTypeIds = new Set(finishedMemberships.map((m) => m.activity.typeId));

  let foundCurrent = false;
  return types.map((type) => {
    const isCompleted = finishedTypeIds.has(type.id);
    if (isCompleted) {
      return { typeId: type.id, typeName: type.name, order: type.order, state: 'completed' as const };
    }

    const prereqMet = !type.prerequisiteTypeId || finishedTypeIds.has(type.prerequisiteTypeId);
    if (prereqMet && !foundCurrent) {
      foundCurrent = true;
      return { typeId: type.id, typeName: type.name, order: type.order, state: 'current' as const };
    }

    return { typeId: type.id, typeName: type.name, order: type.order, state: 'locked' as const };
  });
}

/** Get activities the user has joined (active memberships) for the cards row */
export async function getUserJoinedActivities(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: {
      userId,
      activity: { status: { in: ['OPEN', 'FULL', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'] } },
    },
    select: {
      role: true,
      completedAt: true,
      activity: {
        include: {
          type: { select: { id: true, name: true } },
          activityTags: {
            include: { tag: { select: { id: true, name: true } } },
          },
          memberships: {
            select: {
              role: true,
              user: { select: { username: true, name: true } },
            },
            orderBy: { joinedAt: 'asc' },
          },
          _count: { select: { memberships: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  return memberships.map((m) => ({
    ...m.activity,
    isEligible: true, // user is already a member so they're eligible
    isMember: true,
    memberRole: m.role,
    memberCompletedAt: m.completedAt?.toISOString() ?? null,
    members: m.activity.memberships.map((member) => ({
      username: member.user.username,
      name: member.user.name,
      role: member.role,
    })),
  }));
}

/**
 * Get activity types for the dashboard with aggregated instance data.
 * Returns one entry per enabled ActivityType, shaped for ActivityBrowser/ActivityCard.
 */
export async function getActivityTypesForDashboard(userId: string) {
  const [types, unlockedTypeIds] = await Promise.all([
    prisma.activityType.findMany({
      where: { isEnabled: true },
      orderBy: { order: 'asc' },
      include: {
        activities: {
          where: { status: { in: ['OPEN', 'FULL', 'SCHEDULED', 'IN_PROGRESS'] } },
          include: {
            activityTags: {
              include: { tag: { select: { id: true, name: true } } },
            },
            memberships: {
              where: { userId },
              select: { role: true },
              take: 1,
            },
            _count: { select: { memberships: true } },
          },
        },
      },
    }),
    getUnlockedTypeIds(userId),
  ]);

  return types.map((type) => {
    // Aggregate across all active instances
    const openSpots = type.activities
      .filter((a) => a.status === 'OPEN')
      .reduce((sum, a) => sum + (a.capacity - a._count.memberships), 0);
    const totalMembers = type.activities.reduce((sum, a) => sum + a._count.memberships, 0);

    // User membership across any instance of this type
    const memberInstance = type.activities.find((a) => a.memberships.length > 0);
    const isMember = !!memberInstance;
    const memberRole = memberInstance?.memberships[0]?.role ?? undefined;

    // Collect unique tags from all instances
    const tagMap = new Map<string, { id: string; name: string }>();
    for (const a of type.activities) {
      for (const at of a.activityTags) {
        tagMap.set(at.tag.id, at.tag);
      }
    }

    // Guide from latest instance (if any)
    const latestInstance = type.activities[0];

    return {
      id: type.id, // typeId used as the card ID
      title: type.name,
      capacity: type.defaultCapacity,
      // Type-level cards are always joinable via overflow — never FULL from a user perspective
      status: 'OPEN' as ActivityStatus,
      guideMarkdown: latestInstance?.guideMarkdown ?? null,
      isOnline: false,
      location: null,
      scheduledAt: null as string | null,
      typeId: type.id,
      type: { id: type.id, name: type.name },
      activityTags: [...tagMap.values()].map((tag) => ({ tag })),
      _count: { memberships: totalMembers },
      openSpots,
      instanceCount: type.activities.length,
      isEligible: unlockedTypeIds.has(type.id),
      isMember,
      memberRole,
    };
  });
}

/**
 * Check whether a user has any virtual-group memberships.
 * Used by the dashboard catch-up logic: if a user completed the questionnaire
 * but has no virtual-group memberships, we need to trigger auto-matching.
 */
export async function hasAnyVirtualGroupMembership(userId: string): Promise<boolean> {
  const membership = await prisma.virtualGroupMember.findFirst({
    where: { userId },
    select: { id: true },
  });
  return !!membership;
}

/**
 * Get a summary of user's FORMING virtual groups (groups still waiting for members).
 * Used to show "正在组队中 (2/6)" in the journey flow when the user has no activities yet.
 */
export async function getUserFormingGroupsSummary(userId: string) {
  const groups = await prisma.virtualGroupMember.findMany({
    where: {
      userId,
      virtualGroup: { status: 'FORMING' },
    },
    select: {
      virtualGroup: {
        select: {
          id: true,
          _count: { select: { members: true } },
        },
      },
    },
  });

  if (groups.length === 0) return null;

  // Return the group with the most members (closest to forming)
  const bestGroup = groups.reduce((best, curr) => {
    return curr.virtualGroup._count.members > best.virtualGroup._count.members
      ? curr
      : best;
  });

  return {
    totalFormingGroups: groups.length,
    bestGroupMemberCount: bestGroup.virtualGroup._count.members,
    groupSize: 6, // getDefaultGroupSize()
  };
}

/** Get activity detail with full info for the detail popup */
export async function getActivityDetail(id: string) {
  return prisma.activity.findUnique({
    where: { id },
    include: {
      type: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true, username: true } },
      activityTags: {
        include: { tag: { select: { id: true, name: true } } },
      },
      _count: { select: { memberships: true } },
    },
  });
}
