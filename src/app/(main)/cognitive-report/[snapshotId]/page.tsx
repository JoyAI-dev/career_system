import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getSnapshotAnswersWithComments } from '@/server/queries/comment';
import { SnapshotDetailClient } from './SnapshotDetailClient';
import Link from 'next/link';

type Props = {
  params: Promise<{ snapshotId: string }>;
};

export default async function SnapshotDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { snapshotId } = await params;

  // Verify snapshot belongs to user
  const snapshot = await prisma.responseSnapshot.findUnique({
    where: { id: snapshotId },
    select: {
      id: true,
      userId: true,
      completedAt: true,
      context: true,
    },
  });

  if (!snapshot || snapshot.userId !== session.user.id) {
    notFound();
  }

  const answersWithComments = await getSnapshotAnswersWithComments(snapshotId);

  // Group by topic > dimension
  type AnswerRow = (typeof answersWithComments)[number];
  type DimensionGroup = {
    dimensionId: string;
    dimensionName: string;
    answers: AnswerRow[];
  };
  type TopicGroup = {
    topicId: string;
    topicName: string;
    dimensions: DimensionGroup[];
  };

  const topicMap = new Map<string, TopicGroup>();
  for (const answer of answersWithComments) {
    const topic = answer.question.dimension.topic;
    const dim = answer.question.dimension;

    if (!topicMap.has(topic.id)) {
      topicMap.set(topic.id, {
        topicId: topic.id,
        topicName: topic.name,
        dimensions: [],
      });
    }
    const tg = topicMap.get(topic.id)!;
    let dg = tg.dimensions.find((d) => d.dimensionId === dim.id);
    if (!dg) {
      dg = { dimensionId: dim.id, dimensionName: dim.name, answers: [] };
      tg.dimensions.push(dg);
    }
    dg.answers.push(answer);
  }

  const grouped = Array.from(topicMap.values());

  // Parse activity tag from context if present
  let activityTag: string | undefined;
  if (snapshot.context && snapshot.context !== 'initial') {
    try {
      const ctx = JSON.parse(snapshot.context);
      if (ctx.tags?.length) {
        activityTag = ctx.tags[0];
      }
    } catch {
      // not JSON, ignore
    }
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Snapshot Details</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(snapshot.completedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            {snapshot.context && snapshot.context !== 'initial' && (
              <> &middot; {activityTag || 'Post-activity update'}</>
            )}
          </p>
        </div>
        <Link
          href="/cognitive-report"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back to Report
        </Link>
      </div>

      <SnapshotDetailClient
        grouped={JSON.parse(JSON.stringify(grouped))}
        activityTag={activityTag}
      />
    </div>
  );
}
