import { requireAdmin } from '@/lib/auth';
import { searchUsers } from '@/server/queries/admin';
import { UserTable } from './UserTable';

type SearchParams = Promise<{
  q?: string;
  page?: string;
  sort?: string;
  order?: string;
}>;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const params = await searchParams;

  const query = params.q || undefined;
  const page = parseInt(params.page || '1', 10);
  const sortBy = (params.sort === 'username' ? 'username' : 'createdAt') as 'createdAt' | 'username';
  const sortOrder = (params.order === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

  const { users, total } = await searchUsers({ query, page, sortBy, sortOrder });
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">User Management</h1>
      <UserTable
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
