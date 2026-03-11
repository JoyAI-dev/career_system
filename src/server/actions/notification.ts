'use server';

import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getNotifications } from '@/server/queries/notification';

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export async function fetchRecentNotifications(): Promise<NotificationItem[]> {
  const session = await requireAuth();
  const items = await getNotifications(session.user.id, { take: 10 });
  return items.map((item) => ({
    ...item,
    type: String(item.type),
    createdAt: item.createdAt.toISOString(),
  }));
}

export async function markNotificationRead(notificationId: string) {
  const session = await requireAuth();

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.user.id },
    data: { isRead: true },
  });

  revalidatePath('/');
}

export async function markAllNotificationsRead() {
  const session = await requireAuth();

  await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath('/');
}
