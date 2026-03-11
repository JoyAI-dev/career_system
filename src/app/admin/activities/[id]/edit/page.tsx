import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { getActivityById } from '@/server/queries/activity';
import { getActivityTypes } from '@/server/queries/activityType';
import { getTags } from '@/server/queries/tag';
import { ActivityForm } from '../../ActivityForm';

export default async function EditActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;

  const [activity, types, tags] = await Promise.all([
    getActivityById(id),
    getActivityTypes(),
    getTags(),
  ]);

  if (!activity) notFound();
  if (activity.status !== 'OPEN') notFound();

  const enabledTypes = types.filter((t) => t.isEnabled);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Edit Activity</h1>
      <ActivityForm
        types={enabledTypes}
        tags={tags}
        activity={{
          id: activity.id,
          typeId: activity.typeId,
          title: activity.title,
          capacity: activity.capacity,
          guideMarkdown: activity.guideMarkdown,
          location: activity.location,
          isOnline: activity.isOnline,
          tagIds: activity.activityTags.map((at) => at.tag.id),
        }}
      />
    </div>
  );
}
