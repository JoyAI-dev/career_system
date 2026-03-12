import { requireAdminPage } from '@/lib/auth';
import { getAllPreferenceCategoriesAdmin } from '@/server/queries/preference';
import { PreferenceManager } from './PreferenceManager';
import { getTranslations } from 'next-intl/server';

export default async function AdminPreferencesPage() {
  await requireAdminPage();

  const [categories, t] = await Promise.all([
    getAllPreferenceCategoriesAdmin(),
    getTranslations('admin.preferences'),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{t('title')}</h1>
      <PreferenceManager categories={categories} />
    </div>
  );
}
