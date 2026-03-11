'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UserTable } from './UserTable';
import type { UserListItem } from '@/server/queries/admin';

type Props = {
  activeTab: 'admin' | 'student';
  users: UserListItem[];
  total: number;
  page: number;
  totalPages: number;
  query: string;
  sortBy: string;
  sortOrder: string;
};

export function UserTabs({ activeTab, users, total, page, totalPages, query, sortBy, sortOrder }: Props) {
  const router = useRouter();
  const t = useTranslations('admin.users');

  function handleTabChange(value: string) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('sort', sortBy);
    params.set('order', sortOrder);
    params.set('tab', value);
    router.push(`/admin/users?${params.toString()}`);
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="student">{t('studentTab')}</TabsTrigger>
        <TabsTrigger value="admin">{t('adminTab')}</TabsTrigger>
      </TabsList>
      <TabsContent value={activeTab} className="mt-4">
        <UserTable
          tab={activeTab}
          users={users}
          total={total}
          page={page}
          totalPages={totalPages}
          query={query}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />
      </TabsContent>
    </Tabs>
  );
}
