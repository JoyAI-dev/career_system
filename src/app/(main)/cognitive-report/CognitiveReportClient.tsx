'use client';

import { useState, useTransition, useCallback } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { updateCurrentAnswer, createSnapshot } from '@/server/actions/questionnaire';
import { QuestionReflections } from '@/components/QuestionReflections';
import type { ScoringResult } from '@/server/scoring';

const CognitiveRadarChart = dynamic(
  () => import('@/components/CognitiveRadarChart').then((mod) => mod.CognitiveRadarChart),
  { ssr: false, loading: () => <ChartLoading /> },
);

function ChartLoading() {
  return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading chart...</div>;
}

// ─── Types ─────────────────────────────────────────────────────────

type AnswerOption = { id: string; label: string; score: number; order: number };
type QuestionNote = { id: string; label: string; content: string };
type Question = {
  id: string;
  title: string;
  order: number;
  notes: QuestionNote[];
  answerOptions: AnswerOption[];
};
type Dimension = { id: string; name: string; order: number; questions: Question[] };
type SubTopic = { id: string; name: string; order: number; dimensions: Dimension[] };
type Topic = { id: string; name: string; order: number; showInReport: boolean; preferenceCategorySlug: string | null; subTopics: SubTopic[] };
type VersionStructure = { id: string; topics: Topic[] } | null;

type SnapshotEntry = {
  id: string;
  completedAt: string;
  context: string | null;
  snapshotLabel: string | null;
  scores: ScoringResult;
};

type CurrentAnswer = { optionId: string; score: number };

type ReflectionItem = { id: string; content: string; activityTag: string | null; createdAt: string };

type PreferenceLabel = { id: string; label: string; value: string };
type PreferenceLabels = Record<string, PreferenceLabel[]>;

type Props = {
  snapshots: SnapshotEntry[];
  currentAnswers: Record<string, CurrentAnswer>;
  versionStructure: VersionStructure;
  reflectionsByQuestion?: Record<string, ReflectionItem[]>;
  currentStageLabel?: string | null;
  preferenceLabels?: PreferenceLabels;
};

// ─── Helpers ─────────────────────────────────────────────────────────

function computeScores(
  answers: Record<string, CurrentAnswer>,
  structure: VersionStructure,
): { topicScores: { topicId: string; topicName: string; score: number }[]; overallScore: number } {
  if (!structure) return { topicScores: [], overallScore: 0 };
  const topicScores: { topicId: string; topicName: string; score: number }[] = [];
  for (const topic of structure.topics) {
    if (!topic.showInReport) continue;
    const questions = topic.subTopics.flatMap((st) => st.dimensions.flatMap((d) => d.questions));
    const scores = questions.map((q) => answers[q.id]?.score ?? 0);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    topicScores.push({ topicId: topic.id, topicName: topic.name, score: Math.round(avg * 100) / 100 });
  }
  const overall = topicScores.length > 0
    ? topicScores.reduce((s, t) => s + t.score, 0) / topicScores.length
    : 0;
  return { topicScores, overallScore: Math.round(overall * 100) / 100 };
}


// ─── Component ─────────────────────────────────────────────────────────

export function CognitiveReportClient({
  snapshots,
  currentAnswers: initialAnswers,
  versionStructure,
  reflectionsByQuestion = {},
  currentStageLabel = null,
  preferenceLabels = {},
}: Props) {
  const t = useTranslations('cognitiveReport');
  const format = useFormatter();
  const [answers, setAnswers] = useState<Record<string, CurrentAnswer>>(initialAnswers);
  const [selectedSnapshotIdx, setSelectedSnapshotIdx] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});

  // Compute current scores client-side
  const currentScores = computeScores(answers, versionStructure);

  // Build ScoringResult-compatible object for radar chart
  const currentScoringResult: ScoringResult = {
    snapshotId: 'current',
    versionId: versionStructure?.id ?? '',
    topicScores: currentScores.topicScores.map((ts) => ({
      ...ts,
      showInReport: true,
      preferenceMode: 'CONTEXT',
      subTopicScores: [],
    })),
    overallScore: currentScores.overallScore,
  };

  const selectedSnapshot = snapshots.length > 0 ? snapshots[selectedSnapshotIdx] : null;

  function extractContextTag(context: string | null): string | null {
    if (!context) return null;
    try {
      const ctx = JSON.parse(context);
      if (ctx?.type === 'activity') {
        if (Array.isArray(ctx.tags) && ctx.tags.length > 0 && typeof ctx.tags[0] === 'string') return ctx.tags[0];
        if (typeof ctx.activityType === 'string' && ctx.activityType) return ctx.activityType;
      }
    } catch {
      // ignore non-json context
    }
    return null;
  }

  const selectedContextTag = selectedSnapshot ? extractContextTag(selectedSnapshot.context) : null;
  const effectiveStageTag = selectedContextTag ?? currentStageLabel;

  const handleAnswerChange = useCallback((questionId: string, optionId: string, score: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { optionId, score } }));
    startTransition(async () => {
      await updateCurrentAnswer(questionId, optionId);
    });
  }, []);

  const handleCreateSnapshot = useCallback(() => {
    startTransition(async () => {
      await createSnapshot(currentStageLabel ?? undefined);
    });
  }, [currentStageLabel]);

  function contextLabel(context: string | null, snapshotLabel: string | null, index: number) {
    if (snapshotLabel) return snapshotLabel;
    if (context === 'initial' || index === 0) return t('initial');
    if (context === 'manual') return t('assessment');
    if (!context) return t('assessment');
    try {
      const ctx = JSON.parse(context);
      if (ctx.type === 'activity') {
        if (ctx.activityType) return t('afterActivity', { activity: ctx.activityType });
        if (ctx.tags?.length) return t('afterActivity', { activity: ctx.tags[0] });
      }
    } catch {
      // not JSON
    }
    return context;
  }

  function toggleTopic(topicId: string) {
    setExpandedTopics((prev) => ({ ...prev, [topicId]: !prev[topicId] }));
  }

  return (
    <div className="space-y-6">
      {/* Radar Chart: Current vs Selected Snapshot */}
      <Card>
        <CardHeader>
          <CardTitle>{t('cognitiveOverview')}</CardTitle>
          <CardDescription>
            {selectedSnapshot
              ? t('comparingSnapshots', {
                  labelA: t('currentState'),
                  labelB: contextLabel(selectedSnapshot.context, selectedSnapshot.snapshotLabel, selectedSnapshotIdx),
                })
              : t('singleAssessment')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CognitiveRadarChart
            initialScores={currentScoringResult}
            currentScores={selectedSnapshot?.scores ?? null}
            labelA={t('currentState')}
            labelB={selectedSnapshot
              ? contextLabel(selectedSnapshot.context, selectedSnapshot.snapshotLabel, selectedSnapshotIdx)
              : undefined}
          />
        </CardContent>
      </Card>

      {/* Overall Score + Snapshot Selector */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('currentState')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{currentScores.overallScore}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('overallScore')}</p>
          </CardContent>
        </Card>

        {snapshots.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('compareWithSnapshot')}</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                value={selectedSnapshotIdx}
                onChange={(e) => setSelectedSnapshotIdx(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {snapshots.map((s, idx) => (
                  <option key={s.id} value={idx}>
                    {contextLabel(s.context, s.snapshotLabel, idx)} — {format.dateTime(new Date(s.completedAt), { dateStyle: 'medium', timeStyle: 'short' })} ({t('scoreLabel', { score: s.scores.overallScore })})
                  </option>
                ))}
              </select>
              {selectedSnapshot && (
                <div className="mt-3 flex items-center gap-4">
                  <div>
                    <p className="text-2xl font-bold">{selectedSnapshot.scores.overallScore}</p>
                    <p className="text-xs text-muted-foreground">{t('snapshotScore')}</p>
                  </div>
                  <div>
                    <p className={`text-lg font-semibold ${
                      currentScores.overallScore - selectedSnapshot.scores.overallScore > 0
                        ? 'text-green-600'
                        : currentScores.overallScore - selectedSnapshot.scores.overallScore < 0
                          ? 'text-red-600'
                          : 'text-muted-foreground'
                    }`}>
                      {currentScores.overallScore - selectedSnapshot.scores.overallScore > 0 ? '+' : ''}
                      {Math.round((currentScores.overallScore - selectedSnapshot.scores.overallScore) * 100) / 100}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('change')}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Topic Score Bars */}
      <Card>
        <CardHeader>
          <CardTitle>{t('topicScores')}</CardTitle>
          <CardDescription>{t('assessmentBreakdown')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {currentScores.topicScores.map((topic) => {
              const snapshotTopic = selectedSnapshot?.scores.topicScores.find(
                (st) => st.topicName === topic.topicName,
              );
              const change = snapshotTopic ? topic.score - snapshotTopic.score : 0;
              const topicInVersion = versionStructure?.topics.find((t) => t.id === topic.topicId);
              const prefSlug = topicInVersion?.preferenceCategorySlug;
              const selections = prefSlug ? preferenceLabels[prefSlug] : undefined;
              const topicQuestions = topicInVersion
                ?.subTopics.flatMap((st) => st.dimensions.flatMap((d) => d.questions)) ?? [];
              const topicReflections = topicQuestions
                .flatMap((q) => reflectionsByQuestion[q.id] ?? [])
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              return (
                <div
                  key={topic.topicId}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div className="w-full">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{topic.topicName}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">{topic.score}</span>
                        {snapshotTopic && change !== 0 && (
                          <span className={`text-xs font-medium ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {change > 0 ? '+' : ''}{Math.round(change * 100) / 100}
                          </span>
                        )}
                      </div>
                    </div>

                    {selections && selections.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {selections.map((s) => (
                          <span
                            key={s.id}
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                          >
                            {s.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {topicReflections.length > 0 && (
                      <div className="mt-3 space-y-2 border-t pt-2">
                        {topicReflections.slice(0, 2).map((r) => {
                          const displayTag = r.activityTag ?? effectiveStageTag;
                          return (
                          <div key={r.id} className="rounded bg-muted/40 px-2.5 py-2 text-xs">
                            <p className="text-foreground">{r.content}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {format.dateTime(new Date(r.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
                              {displayTag && (
                                <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">
                                  {displayTag}
                                </span>
                              )}
                            </p>
                          </div>
                          );
                        })}
                        {topicReflections.length > 2 && (
                          <p className="text-[11px] text-muted-foreground">
                            +{topicReflections.length - 2}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Editable Questions */}
      {versionStructure && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('editAnswers')}</CardTitle>
                <CardDescription>{t('editAnswersDescription')}</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateSnapshot}
                disabled={isPending}
              >
                {t('saveSnapshot')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {versionStructure.topics.map((topic) => {
                const isExpanded = expandedTopics[topic.id] ?? false;
                return (
                  <div key={topic.id} className="rounded-lg border">
                    <button
                      onClick={() => toggleTopic(topic.id)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left"
                    >
                      <span className="text-sm font-semibold">{topic.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="space-y-4 border-t px-4 py-4">
                        {topic.subTopics.flatMap((st) => st.dimensions).map((dimension) => (
                          <div key={dimension.id} className="space-y-3">
                            <h4 className="text-xs font-medium text-muted-foreground">
                              {dimension.name}
                            </h4>
                            {dimension.questions.map((question) => (
                              <div key={question.id} className="space-y-2">
                                <p className="text-sm">{question.title}</p>
                                {question.notes.length > 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    {question.notes.map((note) => (
                                      <span key={note.id} className="block">
                                        <strong>{note.label}:</strong> {note.content}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                  {question.answerOptions.map((option) => {
                                    const isSelected = answers[question.id]?.optionId === option.id;
                                    return (
                                      <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => handleAnswerChange(question.id, option.id, option.score)}
                                        className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                                          isSelected
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                        }`}
                                      >
                                        {option.label}
                                      </button>
                                    );
                                  })}
                                </div>
                                <QuestionReflections
                                  questionId={question.id}
                                  initialReflections={reflectionsByQuestion[question.id] ?? []}
                                  activityTag={effectiveStageTag ?? undefined}
                                />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Snapshot History */}
      {snapshots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('snapshotHistory')}</CardTitle>
            <CardDescription>{t('allAssessments')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">#</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">{t('date')}</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">{t('context')}</th>
                    <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">{t('score')}</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">{t('change')}</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((s, idx) => {
                    const prevScore = idx > 0 ? snapshots[idx - 1].scores.overallScore : null;
                    const change = prevScore !== null
                      ? Math.round((s.scores.overallScore - prevScore) * 100) / 100
                      : null;
                    return (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 text-muted-foreground">{idx + 1}</td>
                        <td className="py-3 pr-4">{format.dateTime(new Date(s.completedAt), { dateStyle: 'medium', timeStyle: 'short' })}</td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                            {contextLabel(s.context, s.snapshotLabel, idx)}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold">
                          {s.scores.overallScore}
                        </td>
                        <td className="py-3 text-right">
                          {change !== null ? (
                            <span className={`text-sm font-semibold ${
                              change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-muted-foreground'
                            }`}>
                              {change > 0 ? '+' : ''}{change}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
