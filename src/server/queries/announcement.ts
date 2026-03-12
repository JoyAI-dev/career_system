import { prisma } from '@/lib/db';

export async function getActiveAnnouncement() {
  try {
    return await prisma.announcement.findFirst({
      where: { isActive: true },
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
