import { requireAdmin } from '@/lib/auth';
import { getActivityTypes } from '@/server/queries/activityType';
import { ActivityTypeManager } from './ActivityTypeManager';

export default async function ActivityTypesPage() {
  await requireAdmin();

  const types = await getActivityTypes();

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Activity Types</h1>
      <ActivityTypeManager types={types} />
    </div>
  );
}
