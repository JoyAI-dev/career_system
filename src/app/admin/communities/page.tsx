import { getTranslations } from 'next-intl/server';
import { requireAdminPage } from '@/lib/auth';
import {
  getCommunityStats,
  getCommunityList,
  getGroupingCategories,
  getCommunitySettings,
} from '@/server/queries/community';
import { CommunityAdminTabs } from './CommunityAdminTabs';

export default async function CommunitiesPage() {
  await requireAdminPage();

  const [t, stats, listData, groupingCategories, settings] = await Promise.all([
    getTranslations('admin.communities'),
    getCommunityStats(),
    getCommunityList(1, 20),
    getGroupingCategories(),
    getCommunitySettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <CommunityAdminTabs
        initialStats={stats}
        initialList={listData}
        groupingCategories={groupingCategories}
        settings={settings}
      />
    </div>
  );
}
