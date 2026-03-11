import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserActivities } from '@/server/queries/activity';
import { getActivityTypes } from '@/server/queries/activityType';
import { getTags } from '@/server/queries/tag';
import { ActivityBrowser } from './ActivityBrowser';
import { getTranslations } from 'next-intl/server';

export default async function ActivitiesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [activities, types, tags, t] = await Promise.all([
    getUserActivities(session.user.id),
    getActivityTypes(),
    getTags(),
    getTranslations('activities'),
  ]);

  const enabledTypes = types.filter((t) => t.isEnabled);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{t('title')}</h1>
      <ActivityBrowser
        activities={JSON.parse(JSON.stringify(activities))}
        types={enabledTypes.map((t) => ({ id: t.id, name: t.name }))}
        tags={tags.map((t) => ({ id: t.id, name: t.name }))}
      />
    </div>
  );
}
