import { prisma } from '@/lib/db';

/**
 * Get a snapshot's answers with their comments, grouped by topic/dimension.
 */
export async function getSnapshotAnswersWithComments(snapshotId: string) {
  return prisma.responseAnswer.findMany({
    where: { snapshotId },
    select: {
      id: true,
      questionId: true,
      selectedOption: { select: { id: true, label: true, score: true } },
      question: {
        select: {
          id: true,
          title: true,
          dimension: {
            select: {
              id: true,
              name: true,
              topic: { select: { id: true, name: true } },
            },
          },
        },
      },
      comments: {
        select: {
          id: true,
          content: true,
          activityTag: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}
