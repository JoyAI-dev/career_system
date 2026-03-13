import { prisma } from '@/lib/db';

export type AnswerWithComments = {
  id: string;
  questionId: string;
  preferenceOptionId: string | null;
  selectedOption: { id: string; label: string; score: number };
  question: {
    id: string;
    title: string;
    dimension: {
      id: string;
      name: string;
      subTopic: {
        id: string;
        name: string;
        topic: { id: string; name: string };
      };
    };
  };
  comments: {
    id: string;
    content: string;
    activityTag: string | null;
    createdAt: Date;
  }[];
};

/**
 * Get a snapshot's answers with their comments, grouped by topic/subTopic/dimension.
 */
export async function getSnapshotAnswersWithComments(snapshotId: string): Promise<AnswerWithComments[]> {
  return prisma.responseAnswer.findMany({
    where: { snapshotId },
    select: {
      id: true,
      questionId: true,
      preferenceOptionId: true,
      selectedOption: { select: { id: true, label: true, score: true } },
      question: {
        select: {
          id: true,
          title: true,
          dimension: {
            select: {
              id: true,
              name: true,
              subTopic: {
                select: {
                  id: true,
                  name: true,
                  topic: { select: { id: true, name: true } },
                },
              },
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
