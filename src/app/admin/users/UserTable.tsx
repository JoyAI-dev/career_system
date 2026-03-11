'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { UserListItem } from '@/server/queries/admin';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type Props = {
  users: UserListItem[];
  total: number;
  page: number;
  totalPages: number;
  query: string;
  sortBy: string;
  sortOrder: string;
};

export function UserTable({ users, total, page, totalPages, query, sortBy, sortOrder }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(query);

  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams();
    const values = { q: query, page: String(page), sort: sortBy, order: sortOrder, ...overrides };
    for (const [k, v] of Object.entries(values)) {
      if (v) params.set(k, String(v));
    }
    return `/admin/users?${params.toString()}`;
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildUrl({ q: search, page: 1 }));
  }

  function handleSort(field: string) {
    const newOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
    router.push(buildUrl({ sort: field, order: newOrder, page: 1 }));
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username, name, school, major..."
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button type="submit" size="sm">Search</Button>
        {query && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch('');
              router.push('/admin/users');
            }}
          >
            Clear
          </Button>
        )}
      </form>

      <p className="text-sm text-muted-foreground">{total} users found</p>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th
                    className="cursor-pointer px-4 py-3 font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => handleSort('username')}
                  >
                    Username {sortBy === 'username' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">School</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Questionnaire</th>
                  <th
                    className="cursor-pointer px-4 py-3 font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => handleSort('createdAt')}
                  >
                    Registered {sortBy === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium">{user.username}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.school || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.role === 'ADMIN'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${user.hasSnapshot ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {user.hasSnapshot ? 'Completed' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => router.push(buildUrl({ page: page - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => router.push(buildUrl({ page: page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
