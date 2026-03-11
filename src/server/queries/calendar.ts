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
      type: { select: { id: true, name: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  });
}
