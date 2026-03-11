import { prisma } from '@/lib/db';

type NotifType = 'ACTIVITY_FULL' | 'TIME_CONFIRMED' | 'NEW_COMMENT';

type NotifData = {
  userId: string;
  type: NotifType;
  title: string;
  message: string;
};

/**
 * Create a notification for a single user.
 * Can be called with a transaction client or the default prisma client.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createNotification(data: NotifData, tx?: any) {
  const client = tx ?? prisma;
  return (client as any).notification.create({ data });
}

/**
 * Create notifications for multiple users (bulk).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createNotifications(entries: NotifData[], tx?: any) {
  if (entries.length === 0) return;
  const client = tx ?? prisma;
  return (client as any).notification.createMany({ data: entries });
}

/**
 * Notify all members of an activity.
 */
export async function notifyActivityMembers(
  activityId: string,
  type: NotifType,
  title: string,
  message: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: any,
  excludeUserId?: string,
) {
  const client = tx ?? prisma;
  const memberships = await (client as any).membership.findMany({
    where: { activityId },
    select: { userId: true },
  });

  const entries: NotifData[] = memberships
    .filter((m: { userId: string }) => m.userId !== excludeUserId)
    .map((m: { userId: string }) => ({
      userId: m.userId,
      type,
      title,
      message,
    }));

  return createNotifications(entries, tx);
}
