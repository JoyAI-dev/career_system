import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getUserSnapshotIds } from '@/server/queries/questionnaire';
import { getSnapshotScores } from '@/server/scoring';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { CognitiveReportClient } from './CognitiveReportClient';

export default async function CognitiveReportPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const snapshotMeta = await getUserSnapshotIds(session.user.id);

  if (snapshotMeta.length === 0) {
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

  // Compute scores for all snapshots
  const snapshots = await Promise.all(
    snapshotMeta.map(async (s) => ({
      id: s.id,
      completedAt: s.completedAt.toISOString(),
      context: s.context,
      scores: await getSnapshotScores(s.id),
    })),
  );

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

      <CognitiveReportClient snapshots={snapshots} />
    </div>
  );
}
