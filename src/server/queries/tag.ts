import { prisma } from '@/lib/db';

export async function getTags() {
  return prisma.tag.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { activityTags: true },
      },
    },
  });
}
