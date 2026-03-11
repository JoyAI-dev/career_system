import { requireAdminPage } from '@/lib/auth';
import { getActivityTypes } from '@/server/queries/activityType';
import { ActivityTypeManager } from './ActivityTypeManager';
import { getTranslations } from 'next-intl/server';

export default async function ActivityTypesPage() {
  await requireAdminPage();

  const [types, t] = await Promise.all([getActivityTypes(), getTranslations('admin.activityTypes')]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{t('title')}</h1>
      <ActivityTypeManager types={types} />
    </div>
  );
}
