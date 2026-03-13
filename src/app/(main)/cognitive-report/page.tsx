import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  getUserSnapshotIds,
  getCurrentRecord,
  getActiveVersionWithStructure,
} from '@/server/queries/questionnaire';
import { getActivityProgress } from '@/server/queries/activity';
import { getUserReflections } from '@/server/queries/reflection';
import { getSnapshotScores } from '@/server/scoring';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { CognitiveReportClient } from './CognitiveReportClient';
import { getTranslations } from 'next-intl/server';

export default async function CognitiveReportPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const [snapshotMeta, currentRecord, version, reflectionsByQuestion, steps, t] = await Promise.all([
    getUserSnapshotIds(session.user.id),
    getCurrentRecord(session.user.id),
    getActiveVersionWithStructure(),
    getUserReflections(session.user.id),
    getActivityProgress(session.user.id),
    getTranslations('cognitiveReport'),
  ]);

  const currentStep = steps.find((s) => s.state === 'current');

  // No data at all — user hasn't completed questionnaire
  if (!currentRecord && snapshotMeta.length === 0) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-4 text-3xl font-bold tracking-tight">{t('title')}</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {t('completeFirst')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Build current answers map: questionId → { optionId, score }
  const currentAnswers: Record<string, { optionId: string; score: number }> = {};
  if (currentRecord) {
    for (const a of currentRecord.answers) {
      currentAnswers[a.questionId] = {
        optionId: a.selectedOptionId,
        score: a.selectedOption.score,
      };
    }
  } else if (snapshotMeta.length > 0) {
    // Legacy: no current record, use latest snapshot as current answers
    const latestId = snapshotMeta[snapshotMeta.length - 1].id;
    const latestScores = await getSnapshotScores(latestId);
    // We need the actual answers, not just scores — fetch from snapshot
    const { prisma } = await import('@/lib/db');
    const latestAnswers = await prisma.responseAnswer.findMany({
      where: { snapshotId: latestId },
      select: { questionId: true, selectedOptionId: true, selectedOption: { select: { score: true } } },
    });
    for (const a of latestAnswers) {
      currentAnswers[a.questionId] = {
        optionId: a.selectedOptionId,
        score: a.selectedOption.score,
      };
    }
  }

  // Compute scores for snapshots
  const snapshots = await Promise.all(
    snapshotMeta.map(async (s) => ({
      id: s.id,
      completedAt: s.completedAt.toISOString(),
      context: s.context,
      snapshotLabel: s.snapshotLabel,
      scores: await getSnapshotScores(s.id),
    })),
  );

  // Build version structure for client-side editing
  const versionStructure = version
    ? {
        id: version.id,
        topics: version.topics.map((t) => ({
          id: t.id,
          name: t.name,
          order: t.order,
          showInReport: t.showInReport,
          subTopics: t.subTopics.map((st) => ({
            id: st.id,
            name: st.name,
            order: st.order,
            dimensions: st.dimensions.map((d) => ({
              id: d.id,
              name: d.name,
              order: d.order,
              questions: d.questions.map((q) => ({
                id: q.id,
                title: q.title,
                order: q.order,
                notes: q.notes.map((n) => ({
                  id: n.id,
                  label: n.label,
                  content: n.content,
                })),
                answerOptions: q.answerOptions.map((o) => ({
                  id: o.id,
                  label: o.label,
                  score: o.score,
                  order: o.order,
                })),
              })),
            })),
          })),
        })),
      }
    : null;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <Link
          href="/profile"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t('backToProfile')}
        </Link>
      </div>

      <CognitiveReportClient
        snapshots={snapshots}
        currentAnswers={currentAnswers}
        versionStructure={versionStructure}
        reflectionsByQuestion={reflectionsByQuestion}
        currentStageLabel={currentStep?.typeName ?? null}
      />
    </div>
  );
}
