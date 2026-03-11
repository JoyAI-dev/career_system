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
 * A type is unlocked if it has no prerequisite, or the user has been a member
 * of a COMPLETED activity of the prerequisite type.
 */
export async function getUnlockedTypeIds(userId: string): Promise<Set<string>> {
  const types = await prisma.activityType.findMany({
    where: { isEnabled: true },
    orderBy: { order: 'asc' },
    select: { id: true, prerequisiteTypeId: true },
  });

  // Get type IDs where user completed an activity
  const completedMemberships = await prisma.membership.findMany({
    where: {
      userId,
      activity: { status: 'COMPLETED' },
    },
    select: { activity: { select: { typeId: true } } },
  });
  const completedTypeIds = new Set(completedMemberships.map((m) => m.activity.typeId));

  const unlocked = new Set<string>();
  for (const type of types) {
    if (!type.prerequisiteTypeId || completedTypeIds.has(type.prerequisiteTypeId)) {
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
          where: { userId },
          select: { role: true },
          take: 1,
        },
        _count: { select: { memberships: true } },
      },
    }),
    getUnlockedTypeIds(userId),
  ]);

  return activities.map((activity) => {
    const userMembership = activity.memberships[0] ?? null;
    const { memberships: _, ...rest } = activity;
    return {
      ...rest,
      isEligible: unlockedTypeIds.has(activity.typeId),
      isMember: !!userMembership,
      memberRole: userMembership?.role ?? undefined,
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
 */
export async function getActivityProgress(userId: string): Promise<ActivityProgressStep[]> {
  const types = await prisma.activityType.findMany({
    where: { isEnabled: true },
    orderBy: { order: 'asc' },
    select: { id: true, name: true, order: true, prerequisiteTypeId: true },
  });

  const completedMemberships = await prisma.membership.findMany({
    where: {
      userId,
      activity: { status: 'COMPLETED' },
    },
    select: { activity: { select: { typeId: true } } },
  });
  const completedTypeIds = new Set(completedMemberships.map((m) => m.activity.typeId));

  let foundCurrent = false;
  return types.map((type) => {
    const isCompleted = completedTypeIds.has(type.id);
    if (isCompleted) {
      return { typeId: type.id, typeName: type.name, order: type.order, state: 'completed' as const };
    }

    const prereqMet = !type.prerequisiteTypeId || completedTypeIds.has(type.prerequisiteTypeId);
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
      activity: { status: { in: ['OPEN', 'FULL', 'SCHEDULED', 'IN_PROGRESS'] } },
    },
    select: {
      role: true,
      activity: {
        include: {
          type: { select: { id: true, name: true } },
          activityTags: {
            include: { tag: { select: { id: true, name: true } } },
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
  }));
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
