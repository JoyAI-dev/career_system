'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { UserListItem } from '@/server/queries/admin';

type Props = {
  tab: 'admin' | 'student';
  users: UserListItem[];
  total: number;
  page: number;
  totalPages: number;
  query: string;
  sortBy: string;
  sortOrder: string;
};

export function UserTable({ tab, users, total, page, totalPages, query, sortBy, sortOrder }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(query);
  const t = useTranslations('admin.users');
  const locale = useLocale();

  const isStudent = tab === 'student';

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams();
    const values = { q: query, page: String(page), sort: sortBy, order: sortOrder, tab, ...overrides };
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

  const colCount = isStudent ? 7 : 5;

  return (
    <div className="space-y-4">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button type="submit" size="sm">{t('search')}</Button>
        {query && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch('');
              router.push(`/admin/users?tab=${tab}`);
            }}
          >
            {t('clear')}
          </Button>
        )}
      </form>

      <p className="text-sm text-muted-foreground">{t('usersFound', { count: total })}</p>

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
                    {t('username')} {sortBy === 'username' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">{t('name')}</th>
                  {isStudent && (
                    <th className="px-4 py-3 font-medium text-muted-foreground">{t('school')}</th>
                  )}
                  {isStudent && (
                    <th className="px-4 py-3 font-medium text-muted-foreground">{t('questionnaireStatus')}</th>
                  )}
                  {isStudent && (
                    <th className="px-4 py-3 font-medium text-muted-foreground">{t('score')}</th>
                  )}
                  <th
                    className="cursor-pointer px-4 py-3 font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => handleSort('createdAt')}
                  >
                    {t('registered')} {sortBy === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium">{user.username}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.name || '—'}</td>
                    {isStudent && (
                      <td className="px-4 py-3 text-muted-foreground">{user.school || '—'}</td>
                    )}
                    {isStudent && (
                      <td className="px-4 py-3">
                        <span className={`text-xs ${user.hasSnapshot ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {user.hasSnapshot ? t('completed') : t('pending')}
                        </span>
                      </td>
                    )}
                    {isStudent && (
                      <td className="px-4 py-3">
                        {user.overallScore !== null ? (
                          <span className="text-xs font-medium">{user.overallScore}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        {t('view')}
                      </Link>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={colCount} className="px-4 py-8 text-center text-muted-foreground">
                      {t('noUsers')}
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
            {t('pageOf', { page, totalPages })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => router.push(buildUrl({ page: page - 1 }))}
            >
              {t('previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => router.push(buildUrl({ page: page + 1 }))}
            >
              {t('next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
