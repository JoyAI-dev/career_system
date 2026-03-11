import { requireAdminPage } from '@/lib/auth';
import { getActivityTypes } from '@/server/queries/activityType';
import { getTags } from '@/server/queries/tag';
import { ActivityForm } from '../ActivityForm';
import { getTranslations } from 'next-intl/server';

export default async function NewActivityPage() {
  await requireAdminPage();

  const [types, tags, t] = await Promise.all([getActivityTypes(), getTags(), getTranslations('admin.activities')]);

  const enabledTypes = types.filter((t) => t.isEnabled);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{t('createActivity')}</h1>
      <ActivityForm types={enabledTypes} tags={tags} />
    </div>
  );
}
