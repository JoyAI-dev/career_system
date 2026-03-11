'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { ScoringResult } from '@/server/scoring';

type Props = {
  initialScores: ScoringResult;
  currentScores: ScoringResult | null;
};

export function CognitiveRadarChart({ initialScores, currentScores }: Props) {
  // Build data array with topic names as axes
  const data = initialScores.topicScores.map((topic) => {
    const currentTopic = currentScores?.topicScores.find(
      (t) => t.topicName === topic.topicName,
    );

    return {
      topic: topic.topicName,
      initial: topic.score,
      ...(currentScores ? { current: currentTopic?.score ?? 0 } : {}),
    };
  });

  const hasComparison = currentScores !== null;

  return (
    <ResponsiveContainer width="100%" height={400}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis
          dataKey="topic"
          tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
        />
        <Radar
          name="Initial"
          dataKey="initial"
          stroke="hsl(210, 70%, 55%)"
          fill="hsl(210, 70%, 55%)"
          fillOpacity={0.15}
          strokeWidth={2}
        />
        {hasComparison && (
          <Radar
            name="Current"
            dataKey="current"
            stroke="hsl(150, 60%, 45%)"
            fill="hsl(150, 60%, 45%)"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        )}
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Legend />
      </RadarChart>
    </ResponsiveContainer>
  );
}
