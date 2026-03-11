import { prisma } from '@/lib/db';
import { type ActivityStatus } from '@prisma/client';

export async function getActivities(status?: ActivityStatus) {
  return prisma.activity.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      type: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true, username: true } },
      activityTags: {
        include: { tag: { select: { id: true, name: true } } },
      },
      _count: { select: { memberships: true } },
    },
  });
}

export async function getActivityById(id: string) {
  return prisma.activity.findUnique({
    where: { id },
    include: {
      type: { select: { id: true, name: true } },
      activityTags: {
        include: { tag: { select: { id: true, name: true } } },
      },
      _count: { select: { memberships: true } },
    },
  });
}
