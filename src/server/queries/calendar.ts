import { prisma } from '@/lib/db';

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
