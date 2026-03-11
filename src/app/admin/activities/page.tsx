import { requireAdmin } from '@/lib/auth';
import { getActivities } from '@/server/queries/activity';
import { getActivityTypes } from '@/server/queries/activityType';
import { getTags } from '@/server/queries/tag';
import { ActivityList } from './ActivityList';
import { getTranslations } from 'next-intl/server';

export default async function ActivitiesPage() {
  await requireAdmin();

  const [activities, types, tags, t] = await Promise.all([
    getActivities(),
    getActivityTypes(),
    getTags(),
    getTranslations('admin.activities'),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{t('title')}</h1>
      <ActivityList
        activities={activities}
        types={types}
        tags={tags}
      />
    </div>
  );
}
