import { requireAdmin } from '@/lib/auth';
import { getActivities } from '@/server/queries/activity';
import { getActivityTypes } from '@/server/queries/activityType';
import { getTags } from '@/server/queries/tag';
import { ActivityList } from './ActivityList';

export default async function ActivitiesPage() {
  await requireAdmin();

  const [activities, types, tags] = await Promise.all([
    getActivities(),
    getActivityTypes(),
    getTags(),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Activities</h1>
      <ActivityList
        activities={activities}
        types={types}
        tags={tags}
      />
    </div>
  );
}
