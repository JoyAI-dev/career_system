import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getUserSnapshotIds } from '@/server/queries/questionnaire';
import { getSnapshotScores } from '@/server/scoring';
import { CognitiveRadarChart } from '@/components/CognitiveRadarChart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';

export default async function CognitiveReportPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const snapshots = await getUserSnapshotIds(session.user.id);

  if (snapshots.length === 0) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold">Cognitive Boundary Report</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Complete the questionnaire first to see your cognitive boundary report.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initialSnapshot = snapshots[0];
  const latestSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 1] : null;

  const initialScores = await getSnapshotScores(initialSnapshot.id);
  const currentScores = latestSnapshot
    ? await getSnapshotScores(latestSnapshot.id)
    : null;

  // Calculate growth per topic
  const growthData = initialScores.topicScores.map((topic) => {
    const currentTopic = currentScores?.topicScores.find(
      (t) => t.topicName === topic.topicName,
    );
    const change = currentTopic ? currentTopic.score - topic.score : 0;
    return {
      topicName: topic.topicName,
      initial: topic.score,
      current: currentTopic?.score ?? topic.score,
      change,
    };
  });

  const sortedByGrowth = [...growthData].sort((a, b) => b.change - a.change);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cognitive Boundary Report</h1>
        <Link
          href="/profile"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back to Profile
        </Link>
      </div>

      {/* Radar Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Cognitive State Overview</CardTitle>
          <CardDescription>
            {currentScores
              ? 'Comparing your initial assessment with your latest results.'
              : 'Your initial cognitive boundary assessment.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CognitiveRadarChart
            initialScores={initialScores}
            currentScores={currentScores}
          />
        </CardContent>
      </Card>

      {/* Score Summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Overall Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Initial</p>
              <p className="text-3xl font-bold">{initialScores.overallScore}</p>
            </div>
            {currentScores && (
              <>
                <div className="text-2xl text-muted-foreground">→</div>
                <div>
                  <p className="text-sm text-muted-foreground">Current</p>
                  <p className="text-3xl font-bold">{currentScores.overallScore}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Change</p>
                  <p className={`text-3xl font-bold ${
                    currentScores.overallScore - initialScores.overallScore > 0
                      ? 'text-green-600'
                      : currentScores.overallScore - initialScores.overallScore < 0
                        ? 'text-red-600'
                        : 'text-muted-foreground'
                  }`}>
                    {currentScores.overallScore - initialScores.overallScore > 0 ? '+' : ''}
                    {Math.round((currentScores.overallScore - initialScores.overallScore) * 100) / 100}
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Growth Summary */}
      {currentScores && (
        <Card>
          <CardHeader>
            <CardTitle>Growth Summary</CardTitle>
            <CardDescription>Topics ranked by improvement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedByGrowth.map((item) => (
                <div
                  key={item.topicName}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{item.topicName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.initial} → {item.current}
                    </p>
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
                    {item.change > 0 ? '+' : ''}{item.change}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Topic Details for single snapshot */}
      {!currentScores && (
        <Card>
          <CardHeader>
            <CardTitle>Topic Scores</CardTitle>
            <CardDescription>Your initial assessment breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {initialScores.topicScores.map((topic) => (
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
    </div>
  );
}
