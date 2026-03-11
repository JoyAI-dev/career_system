import { prisma } from '@/lib/db';

export type ReflectionItem = {
  id: string;
  content: string;
  activityTag: string | null;
  createdAt: string;
};

/**
 * Fetch all reflections for a user, grouped by questionId.
 * Used by server components to pass initial data to QuestionReflections.
 */
export async function getUserReflections(userId: string): Promise<Record<string, ReflectionItem[]>> {
  const reflections = await prisma.reflection.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      questionId: true,
      content: true,
      activityTag: true,
      createdAt: true,
    },
  });

  const byQuestion: Record<string, ReflectionItem[]> = {};
  for (const r of reflections) {
    const item: ReflectionItem = {
      id: r.id,
      content: r.content,
      activityTag: r.activityTag,
      createdAt: r.createdAt.toISOString(),
    };
    if (!byQuestion[r.questionId]) byQuestion[r.questionId] = [];
    byQuestion[r.questionId].push(item);
  }
  return byQuestion;
}
