import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import { getActivityById } from '@/server/queries/activity';
import { getActivityTypes } from '@/server/queries/activityType';
import { getTags } from '@/server/queries/tag';
import { ActivityForm } from '../../ActivityForm';

export default async function EditActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();

  const { id } = await params;

  const [activity, types, tags, t] = await Promise.all([
    getActivityById(id),
    getActivityTypes(),
    getTags(),
    getTranslations('admin.activities'),
  ]);

  if (!activity) notFound();
  if (activity.status !== 'OPEN') notFound();

  const enabledTypes = types.filter((t) => t.isEnabled);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{t('editActivity')}</h1>
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
