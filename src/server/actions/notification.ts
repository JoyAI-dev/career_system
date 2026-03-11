'use server';

import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

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
