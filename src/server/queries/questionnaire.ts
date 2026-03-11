import { prisma } from '@/lib/db';

export async function hasCompletedQuestionnaire(userId: string) {
  const snapshot = await prisma.responseSnapshot.findFirst({
    where: { userId },
    select: { id: true },
  });
  return !!snapshot;
}

export async function getActiveVersionWithStructure() {
  return prisma.questionnaireVersion.findFirst({
    where: { isActive: true },
    include: {
      topics: {
        orderBy: { order: 'asc' },
        include: {
          dimensions: {
            orderBy: { order: 'asc' },
            include: {
              questions: {
                orderBy: { order: 'asc' },
                include: {
                  notes: true,
                  answerOptions: {
                    orderBy: { order: 'asc' },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function getQuestionnaireVersions() {
  return prisma.questionnaireVersion.findMany({
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function getVersionStructure(versionId: string) {
  return prisma.questionnaireVersion.findUnique({
    where: { id: versionId },
    include: {
      topics: {
        orderBy: { order: 'asc' },
        include: {
          dimensions: {
            orderBy: { order: 'asc' },
            include: {
              questions: {
                orderBy: { order: 'asc' },
                include: {
                  notes: true,
                  answerOptions: {
                    orderBy: { order: 'asc' },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function getActiveVersion() {
  return prisma.questionnaireVersion.findFirst({
    where: { isActive: true },
    select: { id: true, version: true },
  });
}

export async function getUserSnapshotIds(userId: string) {
  const snapshots = await prisma.responseSnapshot.findMany({
    where: { userId, isSnapshot: true },
    orderBy: { completedAt: 'asc' },
    select: { id: true, completedAt: true, context: true, snapshotLabel: true },
  });
  return snapshots;
}

/**
 * Get the user's current (non-snapshot, editable) record with answers.
 */
export async function getCurrentRecord(userId: string) {
  return prisma.responseSnapshot.findFirst({
    where: { userId, isSnapshot: false },
    include: {
      answers: {
        select: {
          questionId: true,
          selectedOptionId: true,
          selectedOption: { select: { score: true } },
        },
      },
    },
  });
}

/**
 * Get the user's most recent snapshot answers as a map of questionId → optionId.
 */
export async function getLatestSnapshotAnswers(userId: string): Promise<Record<string, string>> {
  const latestSnapshot = await prisma.responseSnapshot.findFirst({
    where: { userId },
    orderBy: { completedAt: 'desc' },
    select: {
      answers: {
        select: { questionId: true, selectedOptionId: true },
      },
    },
  });
  if (!latestSnapshot) return {};
  const map: Record<string, string> = {};
  for (const answer of latestSnapshot.answers) {
    map[answer.questionId] = answer.selectedOptionId;
  }
  return map;
}

export async function getQuestionWithOptions(questionId: string) {
  return prisma.question.findUnique({
    where: { id: questionId },
    include: {
      answerOptions: {
        orderBy: { order: 'asc' },
      },
      dimension: {
        include: {
          topic: {
            include: {
              version: {
                select: { id: true, version: true, isActive: true },
              },
            },
          },
        },
      },
    },
  });
}
