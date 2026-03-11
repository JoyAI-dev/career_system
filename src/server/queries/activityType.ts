import { prisma } from '@/lib/db';

export async function getActivityTypes() {
  return prisma.activityType.findMany({
    orderBy: { order: 'asc' },
    include: {
      prerequisiteType: {
        select: { id: true, name: true },
      },
    },
  });
}
