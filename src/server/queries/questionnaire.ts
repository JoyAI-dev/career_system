import { prisma } from '@/lib/db';

export async function hasCompletedQuestionnaire(userId: string) {
  const snapshot = await prisma.responseSnapshot.findFirst({
    where: { userId, isSnapshot: true },
    select: { id: true },
  });
  return !!snapshot;
}

/**
 * Get saved draft answers (from the current non-snapshot record).
 * Returns a map of answerKey → optionId, or empty if no draft exists.
 * For REPEAT mode: key is `questionId::preferenceOptionId`
 * For FILTER/CONTEXT: key is `questionId`
 */
export async function getSavedDraftAnswers(userId: string): Promise<Record<string, string>> {
  const draft = await prisma.responseSnapshot.findFirst({
    where: { userId, isSnapshot: false },
    orderBy: { completedAt: 'desc' },
    select: {
      answers: {
        select: { questionId: true, selectedOptionId: true, preferenceOptionId: true },
      },
    },
  });
  if (!draft) return {};
  const map: Record<string, string> = {};
  for (const answer of draft.answers) {
    const key = answer.preferenceOptionId
      ? `${answer.questionId}::${answer.preferenceOptionId}`
      : answer.questionId;
    map[key] = answer.selectedOptionId;
  }
  return map;
}

export async function getActiveVersionWithStructure() {
  return prisma.questionnaireVersion.findFirst({
    where: { isActive: true },
    include: {
      topics: {
        orderBy: { order: 'asc' },
        include: {
          preferenceCategory: { select: { id: true, slug: true, name: true } },
          subTopics: {
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
          preferenceCategory: { select: { id: true, slug: true, name: true } },
          subTopics: {
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
    orderBy: { completedAt: 'desc' },
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
 * Get the user's most recent snapshot answers as a map of answerKey → optionId.
 * For REPEAT mode: key is `questionId::preferenceOptionId`
 * For FILTER/CONTEXT: key is `questionId`
 */
export async function getLatestSnapshotAnswers(userId: string): Promise<Record<string, string>> {
  const latestSnapshot = await prisma.responseSnapshot.findFirst({
    where: { userId },
    orderBy: { completedAt: 'desc' },
    select: {
      answers: {
        select: { questionId: true, selectedOptionId: true, preferenceOptionId: true },
      },
    },
  });
  if (!latestSnapshot) return {};
  const map: Record<string, string> = {};
  for (const answer of latestSnapshot.answers) {
    const key = answer.preferenceOptionId
      ? `${answer.questionId}::${answer.preferenceOptionId}`
      : answer.questionId;
    map[key] = answer.selectedOptionId;
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
          subTopic: {
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
      },
    },
  });
}

/**
 * Get the user's current (non-snapshot) record answers including preferenceOptionId.
 */
export async function getCurrentRecordWithPreferenceInfo(userId: string) {
  return prisma.responseSnapshot.findFirst({
    where: { userId, isSnapshot: false },
    orderBy: { completedAt: 'desc' },
    include: {
      answers: {
        select: {
          questionId: true,
          selectedOptionId: true,
          preferenceOptionId: true,
          selectedOption: { select: { score: true } },
        },
      },
    },
  });
}
