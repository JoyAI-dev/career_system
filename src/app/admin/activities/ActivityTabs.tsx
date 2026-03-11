'use client';

import type { ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ActivityList } from './ActivityList';
import { TagManager } from '../tags/TagManager';

type Props = {
  activeTab: 'activities' | 'tags';
  activities: ComponentProps<typeof ActivityList>['activities'];
  types: ComponentProps<typeof ActivityList>['types'];
  tags: ComponentProps<typeof ActivityList>['tags'];
};

export function ActivityTabs({ activeTab, activities, types, tags }: Props) {
  const router = useRouter();
  const t = useTranslations('admin.activities');

  function handleTabChange(value: string) {
    if (value === 'activities') {
      router.push('/admin/activities');
    } else {
      router.push(`/admin/activities?tab=${value}`);
    }
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="activities">{t('activitiesTab')}</TabsTrigger>
        <TabsTrigger value="tags">{t('tagsTab')}</TabsTrigger>
      </TabsList>
      <TabsContent value={activeTab} className="mt-4">
        {activeTab === 'activities' ? (
          <ActivityList activities={activities} types={types} tags={tags} />
        ) : (
          <TagManager tags={tags} />
        )}
      </TabsContent>
    </Tabs>
  );
}
