import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getActiveVersionWithStructure, getLatestSnapshotAnswers } from '@/server/queries/questionnaire';
import { QuestionnaireUpdateFlow } from './QuestionnaireUpdateFlow';

type SearchParams = Promise<{ activityId?: string }>;

export default async function QuestionnaireUpdatePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { activityId } = await searchParams;

  const [version, previousAnswers] = await Promise.all([
    getActiveVersionWithStructure(),
    getLatestSnapshotAnswers(session.user.id),
  ]);

  if (!version) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Questionnaire Not Available</h1>
        <p className="mt-2 text-muted-foreground">
          No active questionnaire is currently configured. Please contact an administrator.
        </p>
      </div>
    );
  }

  // If activityId provided, fetch activity info for display
  let activityTitle: string | undefined;
  if (activityId) {
    const { prisma } = await import('@/lib/db');
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { title: true },
    });
    activityTitle = activity?.title ?? undefined;
  }

  return (
    <QuestionnaireUpdateFlow
      version={version}
      previousAnswers={previousAnswers}
      activityId={activityId}
      activityTitle={activityTitle}
    />
  );
}
