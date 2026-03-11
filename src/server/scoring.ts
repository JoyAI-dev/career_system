import { prisma } from '@/lib/db';

// ─── Types ───────────────────────────────────────────────────────────

export type QuestionScore = {
  questionId: string;
  questionTitle: string;
  score: number;
};

export type TopicScore = {
  topicId: string;
  topicName: string;
  score: number;
  questionScores: QuestionScore[];
};

export type ScoringResult = {
  snapshotId: string;
  versionId: string;
  topicScores: TopicScore[];
  overallScore: number;
};

// ─── Pure Calculation ────────────────────────────────────────────────

type SnapshotAnswer = {
  questionId: string;
  selectedOption: { score: number };
};

type VersionStructure = {
  topics: {
    id: string;
    name: string;
    dimensions: {
      questions: {
        id: string;
        title: string;
      }[];
    }[];
  }[];
};

/**
 * Pure scoring calculation. Takes snapshot answers and version structure,
 * returns computed scores. No side effects, no DB access.
 */
export function calculateScores(
  snapshotId: string,
  versionId: string,
  answers: SnapshotAnswer[],
  structure: VersionStructure,
): ScoringResult {
  const answerMap = new Map(
    answers.map((a) => [a.questionId, a.selectedOption.score]),
  );

  const topicScores: TopicScore[] = structure.topics.map((topic) => {
    const questions = topic.dimensions.flatMap((d) => d.questions);

    const questionScores: QuestionScore[] = questions.map((q) => ({
      questionId: q.id,
      questionTitle: q.title,
      score: answerMap.get(q.id) ?? 0,
    }));

    const topicScore =
      questionScores.length > 0
        ? questionScores.reduce((sum, qs) => sum + qs.score, 0) / questionScores.length
        : 0;

    return {
      topicId: topic.id,
      topicName: topic.name,
      score: Math.round(topicScore * 100) / 100,
      questionScores,
    };
  });

  const overallScore =
    topicScores.length > 0
      ? topicScores.reduce((sum, ts) => sum + ts.score, 0) / topicScores.length
      : 0;

  return {
    snapshotId,
    versionId,
    topicScores,
    overallScore: Math.round(overallScore * 100) / 100,
  };
}

/**
 * Client-friendly scoring from a map of questionId → score.
 * Used for real-time radar updates without DB round-trip.
 */
export function calculateScoresFromMap(
  questionScoreMap: Record<string, number>,
  structure: VersionStructure,
): { topicScores: { topicId: string; topicName: string; score: number }[]; overallScore: number } {
  const topicScores = structure.topics.map((topic) => {
    const questions = topic.dimensions.flatMap((d) => d.questions);
    const scores = questions.map((q) => questionScoreMap[q.id] ?? 0);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { topicId: topic.id, topicName: topic.name, score: Math.round(avg * 100) / 100 };
  });
  const overallScore = topicScores.length > 0
    ? topicScores.reduce((s, t) => s + t.score, 0) / topicScores.length
    : 0;
  return { topicScores, overallScore: Math.round(overallScore * 100) / 100 };
}

// ─── Data-Fetching Wrapper ───────────────────────────────────────────

/**
 * Fetches snapshot data from DB and calculates scores.
 * Throws if snapshot not found.
 */
export async function getSnapshotScores(snapshotId: string): Promise<ScoringResult> {
  const snapshot = await prisma.responseSnapshot.findUnique({
    where: { id: snapshotId },
    include: {
      answers: {
        include: {
          selectedOption: {
            select: { score: true },
          },
          question: {
            select: { id: true },
          },
        },
      },
      version: {
        include: {
          topics: {
            orderBy: { order: 'asc' },
            include: {
              dimensions: {
                orderBy: { order: 'asc' },
                include: {
                  questions: {
                    orderBy: { order: 'asc' },
                    select: { id: true, title: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!snapshot) {
    throw new Error(`Snapshot not found: ${snapshotId}`);
  }

  return calculateScores(
    snapshotId,
    snapshot.versionId,
    snapshot.answers,
    snapshot.version,
  );
}
