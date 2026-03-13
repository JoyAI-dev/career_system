import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserJoinedActivities } from '@/server/queries/activity';
import { ActivityCardsRow } from '@/components/ActivityCardsRow';
import { getTranslations } from 'next-intl/server';

export default async function ActivitiesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [joinedActivities, t] = await Promise.all([
    getUserJoinedActivities(session.user.id),
    getTranslations('activities'),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{t('myActivitiesTitle')}</h1>
      <ActivityCardsRow
        activities={joinedActivities.map((a) => ({
          ...a,
          scheduledAt: a.scheduledAt?.toISOString() ?? null,
        }))}
        currentUserId={session.user.id}
      />
    </div>
  );
}
