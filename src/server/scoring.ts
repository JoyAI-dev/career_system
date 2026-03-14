import { prisma } from '@/lib/db';

// ─── Types ───────────────────────────────────────────────────────────

export type QuestionScore = {
  questionId: string;
  questionTitle: string;
  score: number;
};

export type SubTopicScore = {
  subTopicId: string;
  subTopicName: string;
  score: number;
  preferenceOptionId?: string; // For REPEAT: which preference selection
  questionScores: QuestionScore[];
};

export type TopicScore = {
  topicId: string;
  topicName: string;
  score: number;
  showInReport: boolean;
  preferenceMode: string;
  subTopicScores: SubTopicScore[];
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
  preferenceOptionId?: string | null;
};

type VersionStructure = {
  topics: {
    id: string;
    name: string;
    preferenceMode: string;
    showInReport: boolean;
    subTopics: {
      id: string;
      name: string;
      preferenceOptionId: string | null;
      dimensions: {
        questions: {
          id: string;
          title: string;
        }[];
      }[];
    }[];
  }[];
};

/**
 * Pure scoring calculation. Takes snapshot answers and version structure,
 * returns computed scores. No side effects, no DB access.
 *
 * For REPEAT mode: answers are grouped by preferenceOptionId, creating
 * one SubTopicScore per preference selection.
 *
 * For FILTER/CONTEXT: standard SubTopic → Dimension → Question scoring.
 */
export function calculateScores(
  snapshotId: string,
  versionId: string,
  answers: SnapshotAnswer[],
  structure: VersionStructure,
): ScoringResult {
  // Build answer map: for REPEAT use composite key, else just questionId
  const answerMap = new Map<string, number>();
  for (const a of answers) {
    const key = a.preferenceOptionId
      ? `${a.questionId}::${a.preferenceOptionId}`
      : a.questionId;
    answerMap.set(key, a.selectedOption.score);
  }

  // Collect unique preference option IDs used in REPEAT answers
  const repeatPrefIds = new Map<string, Set<string>>(); // questionId → Set<prefOptionId>
  for (const a of answers) {
    if (a.preferenceOptionId) {
      if (!repeatPrefIds.has(a.questionId)) {
        repeatPrefIds.set(a.questionId, new Set());
      }
      repeatPrefIds.get(a.questionId)!.add(a.preferenceOptionId);
    }
  }

  const topicScores: TopicScore[] = structure.topics.map((topic) => {
    let subTopicScores: SubTopicScore[];

    if (topic.preferenceMode === 'REPEAT') {
      // For REPEAT: the single template SubTopic is scored per preference selection
      const templateSubTopic = topic.subTopics[0];
      if (!templateSubTopic) {
        return {
          topicId: topic.id,
          topicName: topic.name,
          score: 0,
          showInReport: topic.showInReport,
          preferenceMode: topic.preferenceMode,
          subTopicScores: [],
        };
      }

      const questions = templateSubTopic.dimensions.flatMap((d) => d.questions);
      // Gather all unique preferenceOptionIds from answers for this topic's questions
      const allPrefIds = new Set<string>();
      for (const q of questions) {
        const prefIds = repeatPrefIds.get(q.id);
        if (prefIds) {
          for (const pid of prefIds) allPrefIds.add(pid);
        }
      }

      subTopicScores = Array.from(allPrefIds).map((prefOptionId) => {
        const qScores: QuestionScore[] = questions.map((q) => ({
          questionId: q.id,
          questionTitle: q.title,
          score: answerMap.get(`${q.id}::${prefOptionId}`) ?? 0,
        }));
        const avg = qScores.length > 0
          ? qScores.reduce((sum, qs) => sum + qs.score, 0) / qScores.length
          : 0;
        return {
          subTopicId: templateSubTopic.id,
          subTopicName: templateSubTopic.name,
          score: Math.round(avg * 100) / 100,
          preferenceOptionId: prefOptionId,
          questionScores: qScores,
        };
      });
    } else {
      // FILTER / CONTEXT: standard per-SubTopic scoring
      subTopicScores = topic.subTopics.map((st) => {
        const questions = st.dimensions.flatMap((d) => d.questions);
        const qScores: QuestionScore[] = questions.map((q) => ({
          questionId: q.id,
          questionTitle: q.title,
          score: answerMap.get(q.id) ?? 0,
        }));
        const avg = qScores.length > 0
          ? qScores.reduce((sum, qs) => sum + qs.score, 0) / qScores.length
          : 0;
        return {
          subTopicId: st.id,
          subTopicName: st.name,
          score: Math.round(avg * 100) / 100,
          preferenceOptionId: st.preferenceOptionId ?? undefined,
          questionScores: qScores,
        };
      });

      // FILTER mode: exclude subtopics with no answers (they were filtered out by user preferences)
      if (topic.preferenceMode === 'FILTER') {
        subTopicScores = subTopicScores.filter((st) =>
          st.questionScores.some((qs) => answerMap.has(qs.questionId)),
        );
      }
    }

    const topicScore = subTopicScores.length > 0
      ? subTopicScores.reduce((sum, st) => sum + st.score, 0) / subTopicScores.length
      : 0;

    return {
      topicId: topic.id,
      topicName: topic.name,
      score: Math.round(topicScore * 100) / 100,
      showInReport: topic.showInReport,
      preferenceMode: topic.preferenceMode,
      subTopicScores,
    };
  });

  // Overall score: only from topics where showInReport = true
  const reportTopics = topicScores.filter((t) => t.showInReport && t.subTopicScores.length > 0);
  const overallScore =
    reportTopics.length > 0
      ? reportTopics.reduce((sum, ts) => sum + ts.score, 0) / reportTopics.length
      : 0;

  return {
    snapshotId,
    versionId,
    topicScores,
    overallScore: Math.round(overallScore * 100) / 100,
  };
}

/**
 * Client-friendly scoring from a map of answerKey → score.
 * Used for real-time radar updates without DB round-trip.
 * Only returns topics where showInReport = true.
 */
export function calculateScoresFromMap(
  questionScoreMap: Record<string, number>,
  structure: VersionStructure,
): { topicScores: { topicId: string; topicName: string; score: number }[]; overallScore: number } {
  const topicScores: { topicId: string; topicName: string; score: number }[] = [];

  for (const topic of structure.topics) {
    if (!topic.showInReport) continue;

    if (topic.preferenceMode === 'REPEAT') {
      // For REPEAT, collect all composite keys and compute average
      const templateSubTopic = topic.subTopics[0];
      if (!templateSubTopic) {
        topicScores.push({ topicId: topic.id, topicName: topic.name, score: 0 });
        continue;
      }
      const questions = templateSubTopic.dimensions.flatMap((d) => d.questions);
      // Find all matching keys in the map for these questions
      const scores: number[] = [];
      for (const [key, score] of Object.entries(questionScoreMap)) {
        const qId = key.includes('::') ? key.split('::')[0] : key;
        if (questions.some((q) => q.id === qId)) {
          scores.push(score);
        }
      }
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      topicScores.push({ topicId: topic.id, topicName: topic.name, score: Math.round(avg * 100) / 100 });
    } else {
      // FILTER / CONTEXT
      const allQuestions = topic.subTopics.flatMap((st) => st.dimensions.flatMap((d) => d.questions));
      // FILTER mode: only score questions the user actually answered (filtered subtopics have no answers)
      const relevantQuestions = topic.preferenceMode === 'FILTER'
        ? allQuestions.filter((q) => q.id in questionScoreMap)
        : allQuestions;
      const scores = relevantQuestions.map((q) => questionScoreMap[q.id] ?? 0);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      topicScores.push({ topicId: topic.id, topicName: topic.name, score: Math.round(avg * 100) / 100 });
    }
  }

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
              subTopics: {
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
      },
    },
  });

  if (!snapshot) {
    throw new Error(`Snapshot not found: ${snapshotId}`);
  }

  return calculateScores(
    snapshotId,
    snapshot.versionId,
    snapshot.answers.map((a) => ({
      questionId: a.questionId,
      selectedOption: a.selectedOption,
      preferenceOptionId: a.preferenceOptionId,
    })),
    snapshot.version,
  );
}
