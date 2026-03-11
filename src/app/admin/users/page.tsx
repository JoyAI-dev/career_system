import { requireAdminPage } from '@/lib/auth';
import { searchUsers } from '@/server/queries/admin';
import { UserTabs } from './UserTabs';
import { getTranslations } from 'next-intl/server';

type SearchParams = Promise<{
  q?: string;
  page?: string;
  sort?: string;
  order?: string;
  tab?: string;
}>;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminPage();
  const [params, t] = await Promise.all([searchParams, getTranslations('admin.users')]);

  const query = params.q || undefined;
  const activeTab = params.tab === 'admin' ? 'admin' : 'student';
  const page = parseInt(params.page || '1', 10);
  const sortBy = (params.sort === 'username' ? 'username' : 'createdAt') as 'createdAt' | 'username';
  const sortOrder = (params.order === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

  const role = activeTab === 'admin' ? 'ADMIN' as const : 'USER' as const;
  const { users, total } = await searchUsers({ query, role, page, sortBy, sortOrder });
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{t('title')}</h1>
      <UserTabs
        activeTab={activeTab}
        users={users}
        total={total}
        page={page}
        totalPages={totalPages}
        query={query || ''}
        sortBy={sortBy}
        sortOrder={sortOrder}
      />
    </div>
  );
}
