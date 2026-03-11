import { requireAdmin } from '@/lib/auth';
import { getActivityTypes } from '@/server/queries/activityType';
import { getTags } from '@/server/queries/tag';
import { ActivityForm } from '../ActivityForm';

export default async function NewActivityPage() {
  await requireAdmin();

  const [types, tags] = await Promise.all([getActivityTypes(), getTags()]);

  const enabledTypes = types.filter((t) => t.isEnabled);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Create Activity</h1>
      <ActivityForm types={enabledTypes} tags={tags} />
    </div>
  );
}
