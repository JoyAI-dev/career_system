import { prisma } from '@/lib/db';

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}

/**
 * Get paginated notifications for a user, newest first.
 */
export async function getNotifications(
  userId: string,
  { take = 20, skip = 0 }: { take?: number; skip?: number } = {},
) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
    skip,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      isRead: true,
      createdAt: true,
    },
  });
}
