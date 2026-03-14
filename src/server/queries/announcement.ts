import { prisma } from '@/lib/db';

export async function getActiveAnnouncement(audience: string = 'ALL') {
  try {
    return await prisma.announcement.findFirst({
      where: { isActive: true, targetAudience: audience },
      select: { id: true, title: true, content: true, countdownSeconds: true },
    });
  } catch {
    return null;
  }
}

export async function hasUserViewedAnnouncement(userId: string, announcementId: string) {
  try {
    const view = await prisma.announcementView.findUnique({
      where: { userId_announcementId: { userId, announcementId } },
      select: { id: true },
    });
    return !!view;
  } catch {
    return false;
  }
}

export async function getAllAnnouncements() {
  try {
    return await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
    });
  } catch {
    return [];
  }
}

/**
 * Check if a user is the leader of any virtual group.
 * Used to determine if they should see leader-specific announcements.
 */
export async function isUserLeaderInAnyGroup(userId: string): Promise<boolean> {
  try {
    const group = await prisma.virtualGroup.findFirst({
      where: { leaderId: userId },
      select: { id: true },
    });
    return !!group;
  } catch {
    return false;
  }
}
