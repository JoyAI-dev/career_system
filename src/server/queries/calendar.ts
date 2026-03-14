import { prisma } from '@/lib/db';
import { getSchedulingConfig } from '@/server/services/activityScheduling';

/**
 * Get activities where the user is a member, for calendar display.
 * Only returns activities with a scheduledAt date.
 */
export async function getUserCalendarEvents(userId: string) {
  return prisma.activity.findMany({
    where: {
      memberships: { some: { userId } },
      scheduledAt: { not: null },
    },
    select: {
      id: true,
      title: true,
      status: true,
      scheduledAt: true,
      location: true,
      isOnline: true,
      type: { select: { id: true, name: true, order: true } },
    },
    orderBy: [
      { type: { order: 'asc' } },
      { scheduledAt: 'asc' },
    ],
  });
}

/**
 * Get activities where the user is a member but no date is scheduled yet.
 * These are typically OPEN/FULL activities waiting for team formation or scheduling.
 */
export async function getUserPendingActivities(userId: string) {
  return prisma.activity.findMany({
    where: {
      memberships: { some: { userId } },
      scheduledAt: null,
      status: { in: ['OPEN', 'FULL'] },
    },
    select: {
      id: true,
      title: true,
      status: true,
      capacity: true,
      type: { select: { id: true, name: true, order: true } },
      _count: { select: { memberships: true } },
    },
    orderBy: [
      { type: { order: 'asc' } },
      { createdAt: 'asc' },
    ],
  });
}

// ── Projected Activity Chain ───────────────────────────────────────

export type ProjectedEvent = {
  typeId: string;
  typeName: string;
  typeOrder: number;
  date: string; // ISO string
  /** 'actual' = real activity exists, 'forming' = group forming, 'projected' = future preview */
  kind: 'actual' | 'forming' | 'projected';
  /** Only for actual activities */
  activityId?: string;
  /** Activity status for actuals, forming state label for projected */
  status: string;
  /** For forming events: current/required member counts */
  formingInfo?: { currentMembers: number; requiredMembers: number };
  /** Activity type guide content (for forming event popup) */
  guideContent?: string | null;
};

/**
 * Build the full projected activity chain for a user's calendar.
 *
 * For each activity type in the chain:
 * - If the user already has a real activity → include as 'actual' with real date & status
 * - If not → calculate projected date based on anchor + intervalHours and include as 'projected'
 *
 * The anchor point is determined by:
 * 1. The latest real activity's scheduledAt (if any exist)
 * 2. Otherwise, today (assumes group could form today)
 */
export async function getProjectedActivityChain(
  userId: string,
): Promise<ProjectedEvent[]> {
  // 1. All enabled activity types in order (include guideContent + peopleRequired for forming info)
  const activityTypes = await prisma.activityType.findMany({
    where: { isEnabled: true },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      name: true,
      order: true,
      intervalHours: true,
      guideContent: true,
      peopleRequired: true,
      prerequisiteTypeId: true,
      scope: true,
    },
  });

  if (activityTypes.length === 0) return [];

  // 2. User's real activities (all statuses) with membership count for forming info
  const realActivities = await prisma.activity.findMany({
    where: { memberships: { some: { userId } } },
    select: {
      id: true,
      typeId: true,
      status: true,
      scheduledAt: true,
      capacity: true,
      type: { select: { order: true } },
      _count: { select: { memberships: true } },
    },
    orderBy: { type: { order: 'asc' } },
  });

  // Map typeId → best real activity (prefer the one with scheduledAt)
  const realByType = new Map<
    string,
    {
      id: string;
      status: string;
      scheduledAt: Date | null;
      capacity: number;
      memberCount: number;
    }
  >();
  for (const a of realActivities) {
    const existing = realByType.get(a.typeId);
    if (!existing || (a.scheduledAt && !existing.scheduledAt)) {
      realByType.set(a.typeId, {
        id: a.id,
        status: a.status,
        scheduledAt: a.scheduledAt,
        capacity: a.capacity,
        memberCount: a._count.memberships,
      });
    }
  }

  // 3. Check user's forming groups and get best member count
  const formingGroups = await prisma.virtualGroupMember.findMany({
    where: { userId, virtualGroup: { status: 'FORMING' } },
    select: {
      virtualGroup: {
        select: { _count: { select: { members: true } } },
      },
    },
  });
  const hasFormingGroup = formingGroups.length > 0;
  const bestFormingMemberCount = hasFormingGroup
    ? Math.max(...formingGroups.map((g) => g.virtualGroup._count.members))
    : 0;

  // 3b. Get user's completed activity type IDs (for prerequisite unlock check)
  const finishedMemberships = await prisma.membership.findMany({
    where: { userId, completedAt: { not: null } },
    select: { activity: { select: { typeId: true } } },
  });
  const finishedTypeIds = new Set(finishedMemberships.map((m) => m.activity.typeId));

  // 4. Determine default activity time from scheduling config
  const config = await getSchedulingConfig();
  const defaultActivityTime = config?.defaultActivityTime ?? '09:00';
  const [defaultH, defaultM] = defaultActivityTime.split(':').map(Number);

  // 5. Build the chain
  const result: ProjectedEvent[] = [];
  let previousTime: Date | null = null;
  let firstFormingUsed = false;

  for (const type of activityTypes) {
    const real = realByType.get(type.id);

    if (real) {
      // Real activity exists — mark as 'forming' if OPEN/FULL, 'actual' otherwise
      const date = real.scheduledAt ?? new Date();
      const isForming = real.status === 'OPEN' || real.status === 'FULL';

      result.push({
        typeId: type.id,
        typeName: type.name,
        typeOrder: type.order,
        date: date.toISOString(),
        kind: isForming ? 'forming' : 'actual',
        activityId: real.id,
        status: real.status,
        ...(isForming
          ? {
              formingInfo: {
                currentMembers: real.memberCount,
                requiredMembers: real.capacity,
              },
              guideContent: type.guideContent,
            }
          : {}),
      });
      if (real.scheduledAt) {
        previousTime = real.scheduledAt;
      }
    } else {
      // Need to project or mark as forming
      if (!previousTime) {
        if (!hasFormingGroup && realByType.size === 0) {
          // User has no groups at all, don't show projected chain
          continue;
        }
        // Anchor to today
        previousTime = new Date();
        previousTime.setHours(defaultH, defaultM, 0, 0);
        if (previousTime <= new Date()) {
          previousTime.setDate(previousTime.getDate() + 1);
        }
      }

      // At this point previousTime must be set (either from a real activity or anchored to today)
      if (!previousTime) continue;

      // Calculate: previousTime + intervalHours → set to defaultActivityTime
      const projectedMs: number =
        previousTime.getTime() + type.intervalHours * 60 * 60 * 1000;
      const projected: Date = new Date(projectedMs);
      projected.setHours(defaultH, defaultM, 0, 0);
      // If same day and in the past, bump to next day
      if (projected <= previousTime) {
        projected.setDate(projected.getDate() + 1);
      }

      // Check if this type is unlocked (prerequisite completed)
      const isUnlocked = !type.prerequisiteTypeId || finishedTypeIds.has(type.prerequisiteTypeId);

      if (hasFormingGroup && !firstFormingUsed) {
        // First unmatched type with forming groups → mark as 'forming'
        firstFormingUsed = true;
        result.push({
          typeId: type.id,
          typeName: type.name,
          typeOrder: type.order,
          date: projected.toISOString(),
          kind: 'forming',
          status: 'forming',
          formingInfo: {
            currentMembers: bestFormingMemberCount,
            requiredMembers: type.peopleRequired,
          },
          guideContent: type.guideContent,
        });
      } else if (isUnlocked) {
        // Prerequisite met but no activity yet (e.g., waiting for pairing)
        // Show as 'forming' (unlocked, ready) instead of 'projected' (locked)
        result.push({
          typeId: type.id,
          typeName: type.name,
          typeOrder: type.order,
          date: projected.toISOString(),
          kind: 'forming',
          status: 'unlocked',
          guideContent: type.guideContent,
          formingInfo: {
            currentMembers: 0,
            requiredMembers: type.peopleRequired,
          },
        });
      } else {
        result.push({
          typeId: type.id,
          typeName: type.name,
          typeOrder: type.order,
          date: projected.toISOString(),
          kind: 'projected',
          status: 'projected',
        });
      }
      previousTime = projected;
    }
  }

  return result;
}
