import { requireAdminPage } from '@/lib/auth';
import { getActivities } from '@/server/queries/activity';
import { getActivityTypes } from '@/server/queries/activityType';
import { getTags } from '@/server/queries/tag';
import { ActivityTabs } from './ActivityTabs';
import { getTranslations } from 'next-intl/server';

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdminPage();

  const { tab } = await searchParams;
  const activeTab = tab === 'tags' ? 'tags' : 'activities';

  const [activities, types, tags, t] = await Promise.all([
    getActivities(),
    getActivityTypes(),
    getTags(),
    getTranslations('admin.activities'),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{t('title')}</h1>
      <ActivityTabs
        activeTab={activeTab}
        activities={activities}
        types={types}
        tags={tags}
      />
    </div>
  );
}
