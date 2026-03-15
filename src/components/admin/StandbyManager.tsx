'use client';

/**
 * StandbyManager
 * Admin panel for managing standby (候补) users.
 *
 * Top section: current standby users with remove button
 * Bottom section: paginated user list with "add as standby" button
 */

import { useState, useEffect, useTransition, useCallback } from 'react';
import { Users, UserPlus, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  addStandby,
  removeStandby,
  getStandbyUsers,
  triggerStandbyFill,
  searchUsersForStandbyAction,
} from '@/server/actions/standbyActions';

// ── Types ──────────────────────────────────────────────────────────

type StandbyUser = {
  id: string;
  userId: string;
  status: string;
  note: string | null;
  createdAt: string;
  matchedAt: string | null;
  user: { id: string; name: string | null; username: string };
  addedBy: { id: string; name: string | null; username: string } | null;
};

type UserLite = {
  id: string;
  username: string;
  name: string | null;
  school: string | null;
  major: string | null;
};

// ── Status labels and colors ────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  AVAILABLE: { label: '待匹配', className: 'bg-green-100 text-green-700' },
  MATCHED: { label: '已匹配', className: 'bg-blue-100 text-blue-700' },
  INACTIVE: { label: '已移除', className: 'bg-gray-100 text-gray-500' },
};

// ── Component ──────────────────────────────────────────────────────

export function StandbyManager() {
  // Standby users state
  const [standbyUsers, setStandbyUsers] = useState<StandbyUser[]>([]);
  const [standbyLoading, setStandbyLoading] = useState(true);

  // All users (paginated) state
  const [allUsers, setAllUsers] = useState<UserLite[]>([]);
  const [standbyUserIds, setStandbyUserIds] = useState<Set<string>>(new Set());
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(15);
  const [userSearch, setUserSearch] = useState('');
  const [userSearchInput, setUserSearchInput] = useState('');
  const [usersLoading, setUsersLoading] = useState(true);

  const [isPending, startTransition] = useTransition();

  // Fill result
  const [fillResult, setFillResult] = useState<string | null>(null);

  const totalPages = Math.ceil(userTotal / userPageSize);

  // ── Data loading ──────────────────────────────────────────────

  const loadStandbyUsers = useCallback(async () => {
    setStandbyLoading(true);
    try {
      const data = await getStandbyUsers();
      setStandbyUsers(data as unknown as StandbyUser[]);
    } finally {
      setStandbyLoading(false);
    }
  }, []);

  const loadAllUsers = useCallback(async (page: number, query: string) => {
    setUsersLoading(true);
    try {
      const data = await searchUsersForStandbyAction(page, query || undefined);
      setAllUsers(data.users);
      setUserTotal(data.total);
      setUserPageSize(data.pageSize);
      setStandbyUserIds(new Set(data.standbyUserIds));
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadStandbyUsers();
    loadAllUsers(1, '');
  }, [loadStandbyUsers, loadAllUsers]);

  // ── Actions ───────────────────────────────────────────────────

  function handleAddStandby(userId: string) {
    startTransition(async () => {
      try {
        await addStandby(userId);
        await Promise.all([loadStandbyUsers(), loadAllUsers(userPage, userSearch)]);
      } catch (err) {
        alert(err instanceof Error ? err.message : '添加失败');
      }
    });
  }

  function handleRemoveStandby(userId: string) {
    if (!confirm('确定移除该候补用户?')) return;
    startTransition(async () => {
      await removeStandby(userId);
      await Promise.all([loadStandbyUsers(), loadAllUsers(userPage, userSearch)]);
    });
  }

  function handleFill() {
    setFillResult(null);
    startTransition(async () => {
      const result = await triggerStandbyFill();
      setFillResult(
        `检查了 ${result.checkedGroups ?? 0} 个小组，填充了 ${result.filledGroups ?? 0} 个小组`,
      );
      await Promise.all([loadStandbyUsers(), loadAllUsers(userPage, userSearch)]);
    });
  }

  function handleUserSearch(e: React.FormEvent) {
    e.preventDefault();
    setUserPage(1);
    setUserSearch(userSearchInput);
    loadAllUsers(1, userSearchInput);
  }

  function handleClearSearch() {
    setUserSearchInput('');
    setUserSearch('');
    setUserPage(1);
    loadAllUsers(1, '');
  }

  function handlePageChange(newPage: number) {
    setUserPage(newPage);
    loadAllUsers(newPage, userSearch);
  }

  // Stats
  const available = standbyUsers.filter((u) => u.status === 'AVAILABLE').length;
  const matched = standbyUsers.filter((u) => u.status === 'MATCHED').length;
  const inactive = standbyUsers.filter((u) => u.status === 'INACTIVE').length;

  return (
    <div className="space-y-6">
      {/* ── Section 1: Standby Users ─────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4" />
            候补用户
          </h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleFill}
              disabled={isPending}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
              检查超时并填充
            </Button>
          </div>
        </div>

        {fillResult && (
          <p className="text-xs text-muted-foreground">{fillResult}</p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card size="sm">
            <CardContent className="py-3 text-center">
              <div className="text-lg font-bold text-green-600">{available}</div>
              <div className="text-xs text-muted-foreground">待匹配</div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="py-3 text-center">
              <div className="text-lg font-bold text-blue-600">{matched}</div>
              <div className="text-xs text-muted-foreground">已匹配</div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="py-3 text-center">
              <div className="text-lg font-bold text-gray-500">{inactive}</div>
              <div className="text-xs text-muted-foreground">已移除</div>
            </CardContent>
          </Card>
        </div>

        {/* Standby user list */}
        {standbyLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">加载中...</div>
        ) : standbyUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Users className="mb-2 h-6 w-6 opacity-40" />
            <p className="text-sm">暂无候补用户</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {standbyUsers.map((su) => {
              const config = STATUS_CONFIG[su.status] ?? STATUS_CONFIG.INACTIVE;
              return (
                <Card key={su.id} size="sm">
                  <CardContent className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${config.className}`}>
                        {config.label}
                      </span>
                      <div>
                        <span className="text-sm font-medium">
                          {su.user.name || su.user.username}
                        </span>
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          ({su.user.username})
                        </span>
                        {su.note && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            - {su.note}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {su.matchedAt && (
                        <span className="text-xs text-muted-foreground">
                          匹配于 {new Date(su.matchedAt).toLocaleDateString('zh-CN')}
                        </span>
                      )}
                      {su.status === 'AVAILABLE' && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleRemoveStandby(su.userId)}
                          disabled={isPending}
                          title="移除候补"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 2: All Users (paginated) ─────────────────────── */}
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="h-4 w-4" />
          添加候补用户
        </h3>

        {/* Search */}
        <form onSubmit={handleUserSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={userSearchInput}
              onChange={(e) => setUserSearchInput(e.target.value)}
              placeholder="搜索用户名、姓名、学校..."
              className="pl-8"
            />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            搜索
          </Button>
          {userSearch && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearSearch}
            >
              清除
            </Button>
          )}
        </form>

        <p className="text-xs text-muted-foreground">
          共 {userTotal} 个学生用户
        </p>

        {/* User table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-4 py-2.5 font-medium text-muted-foreground">用户名</th>
                    <th className="px-4 py-2.5 font-medium text-muted-foreground">姓名</th>
                    <th className="px-4 py-2.5 font-medium text-muted-foreground">学校</th>
                    <th className="px-4 py-2.5 font-medium text-muted-foreground">专业</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        加载中...
                      </td>
                    </tr>
                  ) : allUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        {userSearch ? '没有找到匹配的用户' : '暂无用户'}
                      </td>
                    </tr>
                  ) : (
                    allUsers.map((user) => {
                      const isStandby = standbyUserIds.has(user.id);
                      return (
                        <tr key={user.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="px-4 py-2.5 font-medium">{user.username}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{user.name || '—'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{user.school || '—'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{user.major || '—'}</td>
                          <td className="px-4 py-2.5 text-right">
                            {isStandby ? (
                              <span className="text-xs text-muted-foreground">已是候补</span>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddStandby(user.id)}
                                disabled={isPending}
                              >
                                <UserPlus className="mr-1 h-3.5 w-3.5" />
                                添加为候补
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
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
              第 {userPage} 页 / 共 {totalPages} 页
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={userPage <= 1 || isPending}
                onClick={() => handlePageChange(userPage - 1)}
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={userPage >= totalPages || isPending}
                onClick={() => handlePageChange(userPage + 1)}
              >
                下一页
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
