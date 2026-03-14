'use server';

import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { deleteFile } from '@/lib/storage';
import { revalidatePath } from 'next/cache';

/**
 * Get all meeting minutes for an activity.
 * Only members can view.
 */
export async function getMeetingMinutes(activityId: string) {
  const session = await requireAuth();
  const userId = session.user.id;

  // Verify membership
  const membership = await prisma.membership.findUnique({
    where: { activityId_userId: { activityId, userId } },
  });
  if (!membership) return [];

  return prisma.meetingMinutes.findMany({
    where: { activityId },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { id: true, name: true, username: true } },
    },
  });
}

/**
 * Delete a meeting minutes entry.
 * Only the author can delete their own entry.
 */
export async function deleteMeetingMinutes(minutesId: string) {
  const session = await requireAuth();
  const userId = session.user.id;

  const minutes = await prisma.meetingMinutes.findUnique({
    where: { id: minutesId },
  });
  if (!minutes) {
    return { errors: { _form: ['Not found'] } };
  }
  if (minutes.userId !== userId) {
    return { errors: { _form: ['Unauthorized'] } };
  }

  // Delete DB record
  await prisma.meetingMinutes.delete({ where: { id: minutesId } });

  // Delete file from disk (best effort)
  if (minutes.fileUrl) {
    try {
      await deleteFile(minutes.fileUrl);
    } catch {
      // Non-critical: file cleanup failure is acceptable
    }
  }

  revalidatePath('/activities');
  return { success: true };
}
