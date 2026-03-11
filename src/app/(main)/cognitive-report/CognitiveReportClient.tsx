'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const CognitiveRadarChart = dynamic(
  () => import('@/components/CognitiveRadarChart').then((mod) => mod.CognitiveRadarChart),
  { ssr: false, loading: () => <div className="flex h-64 items-center justify-center text-muted-foreground">Loading chart...</div> },
);
import type { ScoringResult } from '@/server/scoring';

type SnapshotEntry = {
  id: string;
  completedAt: string;
  context: string | null;
  scores: ScoringResult;
};

type Props = {
  snapshots: SnapshotEntry[];
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function contextLabel(context: string | null, index: number) {
  if (context === 'initial' || index === 0) return 'Initial';
  if (!context) return 'Assessment';
  try {
    const ctx = JSON.parse(context);
    if (ctx.type === 'activity' && ctx.tags?.length) {
      return `After ${ctx.tags[0]}`;
    }
  } catch {
    // not JSON, use raw
  }
  return context;
}

function snapshotLabel(snapshot: SnapshotEntry, index: number) {
  const label = contextLabel(snapshot.context, index);
  const date = new Date(snapshot.completedAt).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
  return `${label} — ${date}`;
}

export function CognitiveReportClient({ snapshots }: Props) {
  const [snapshotAIndex, setSnapshotAIndex] = useState(0);
  const [snapshotBIndex, setSnapshotBIndex] = useState(
    snapshots.length > 1 ? snapshots.length - 1 : 0,
  );

  const snapshotA = snapshots[snapshotAIndex];
  const snapshotB = snapshots.length > 1 ? snapshots[snapshotBIndex] : null;
  const hasComparison = snapshotB !== null && snapshotAIndex !== snapshotBIndex;

  // Growth data for comparison
  const growthData = snapshotA.scores.topicScores.map((topic) => {
    const bTopic = snapshotB?.scores.topicScores.find(
      (t) => t.topicName === topic.topicName,
    );
    const change = hasComparison && bTopic ? bTopic.score - topic.score : 0;
    return {
      topicName: topic.topicName,
      scoreA: topic.score,
      scoreB: bTopic?.score ?? topic.score,
      change,
    };
  });

  const sortedByGrowth = [...growthData].sort((a, b) => b.change - a.change);

  return (
    <div className="space-y-6">
      {/* Snapshot Comparison Selectors */}
      {snapshots.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Compare Snapshots</CardTitle>
            <CardDescription>Select two snapshots to compare on the radar chart</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Snapshot A (blue)
                </label>
                <select
                  value={snapshotAIndex}
                  onChange={(e) => setSnapshotAIndex(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {snapshots.map((s, idx) => (
                    <option key={s.id} value={idx}>
                      {contextLabel(s.context, idx)} — {formatDate(s.completedAt)} (Score: {s.scores.overallScore})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Snapshot B (green)
                </label>
                <select
                  value={snapshotBIndex}
                  onChange={(e) => setSnapshotBIndex(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {snapshots.map((s, idx) => (
                    <option key={s.id} value={idx}>
                      {contextLabel(s.context, idx)} — {formatDate(s.completedAt)} (Score: {s.scores.overallScore})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Radar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Cognitive State Overview</CardTitle>
          <CardDescription>
            {hasComparison
              ? `Comparing "${snapshotLabel(snapshotA, snapshotAIndex)}" with "${snapshotLabel(snapshotB, snapshotBIndex)}".`
              : 'Your cognitive boundary assessment.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CognitiveRadarChart
            initialScores={snapshotA.scores}
            currentScores={hasComparison ? snapshotB.scores : null}
            labelA={snapshotLabel(snapshotA, snapshotAIndex)}
            labelB={hasComparison ? snapshotLabel(snapshotB, snapshotBIndex) : undefined}
          />
        </CardContent>
      </Card>

      {/* Overall Score Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-muted-foreground">
                {contextLabel(snapshotA.context, snapshotAIndex)}
              </p>
              <p className="text-3xl font-bold">{snapshotA.scores.overallScore}</p>
            </div>
            {hasComparison && (
              <>
                <div className="text-2xl text-muted-foreground">→</div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {contextLabel(snapshotB.context, snapshotBIndex)}
                  </p>
                  <p className="text-3xl font-bold">{snapshotB.scores.overallScore}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Change</p>
                  <p className={`text-3xl font-bold ${
                    snapshotB.scores.overallScore - snapshotA.scores.overallScore > 0
                      ? 'text-green-600'
                      : snapshotB.scores.overallScore - snapshotA.scores.overallScore < 0
                        ? 'text-red-600'
                        : 'text-muted-foreground'
                  }`}>
                    {snapshotB.scores.overallScore - snapshotA.scores.overallScore > 0 ? '+' : ''}
                    {Math.round((snapshotB.scores.overallScore - snapshotA.scores.overallScore) * 100) / 100}
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Growth Summary (when comparing) */}
      {hasComparison && (
        <Card>
          <CardHeader>
            <CardTitle>Growth Summary</CardTitle>
            <CardDescription>Topics ranked by change</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedByGrowth.map((item, idx) => {
                const isTopGrowth = idx === 0 && item.change > 0;
                return (
                  <div
                    key={item.topicName}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                      isTopGrowth ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-sm font-medium">{item.topicName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.scoreA} → {item.scoreB}
                        </p>
                      </div>
                      {isTopGrowth && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                          Most improved
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        item.change > 0
                          ? 'text-green-600'
                          : item.change < 0
                            ? 'text-red-600'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {item.change > 0 ? '+' : ''}{item.change} {item.change !== 0 ? 'points' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Topic Scores (single snapshot) */}
      {!hasComparison && (
        <Card>
          <CardHeader>
            <CardTitle>Topic Scores</CardTitle>
            <CardDescription>Assessment breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {snapshotA.scores.topicScores.map((topic) => (
                <div
                  key={topic.topicId}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <p className="text-sm font-medium">{topic.topicName}</p>
                  <span className="text-sm font-semibold">{topic.score}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Snapshot History / Score Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Snapshot History</CardTitle>
          <CardDescription>All assessments with overall score trend</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">#</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Date</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Context</th>
                  <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">Score</th>
                  <th className="pb-2 text-right font-medium text-muted-foreground">Change</th>
                  <th className="pb-2 text-right font-medium text-muted-foreground"></th>
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
                      <td className="py-3 pr-4">{formatDate(s.completedAt)}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          {contextLabel(s.context, idx)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold">
                        {s.scores.overallScore}
                      </td>
                      <td className="py-3 text-right">
                        {change !== null ? (
                          <span
                            className={`text-sm font-semibold ${
                              change > 0
                                ? 'text-green-600'
                                : change < 0
                                  ? 'text-red-600'
                                  : 'text-muted-foreground'
                            }`}
                          >
                            {change > 0 ? '+' : ''}{change}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/cognitive-report/${s.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
