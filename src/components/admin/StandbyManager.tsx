'use client';

/**
 * StandbyManager
 * Admin panel for managing standby (候补) users.
 */

import { useState, useEffect, useTransition } from 'react';
import { Users, UserPlus, Trash2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  addStandby,
  removeStandby,
  getStandbyUsers,
  triggerStandbyFill,
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

// ── Status labels and colors ────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  AVAILABLE: { label: '待匹配', className: 'bg-green-100 text-green-700' },
  MATCHED: { label: '已匹配', className: 'bg-blue-100 text-blue-700' },
  INACTIVE: { label: '已移除', className: 'bg-gray-100 text-gray-500' },
};

// ── Component ──────────────────────────────────────────────────────

export function StandbyManager() {
  const [users, setUsers] = useState<StandbyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Add form state
  const [userId, setUserId] = useState('');
  const [note, setNote] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // Fill result
  const [fillResult, setFillResult] = useState<string | null>(null);

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await getStandbyUsers();
      setUsers(data as unknown as StandbyUser[]);
    } finally {
      setLoading(false);
    }
  }

  function handleAdd() {
    if (!userId.trim()) return;
    setAddError(null);
    startTransition(async () => {
      try {
        await addStandby(userId.trim(), note.trim() || undefined);
        setUserId('');
        setNote('');
        await loadUsers();
      } catch (err) {
        setAddError(err instanceof Error ? err.message : '添加失败');
      }
    });
  }

  function handleRemove(targetUserId: string) {
    if (!confirm('确定移除该候补用户?')) return;
    startTransition(async () => {
      await removeStandby(targetUserId);
      await loadUsers();
    });
  }

  function handleFill() {
    setFillResult(null);
    startTransition(async () => {
      const result = await triggerStandbyFill();
      setFillResult(
        `检查了 ${result.checkedGroups ?? 0} 个小组，填充了 ${result.filledGroups ?? 0} 个小组`,
      );
      await loadUsers();
    });
  }

  // Stats
  const available = users.filter((u) => u.status === 'AVAILABLE').length;
  const matched = users.filter((u) => u.status === 'MATCHED').length;
  const inactive = users.filter((u) => u.status === 'INACTIVE').length;

  return (
    <div className="space-y-4">
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

      {/* Add form */}
      <Card size="sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <UserPlus className="h-4 w-4" />
            添加候补用户
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="standby-userId" className="text-xs">用户 ID</Label>
              <Input
                id="standby-userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="输入用户ID"
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="standby-note" className="text-xs">备注 (可选)</Label>
              <Input
                id="standby-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="备注"
                className="mt-1"
              />
            </div>
            <Button onClick={handleAdd} disabled={isPending || !userId.trim()} size="sm">
              添加
            </Button>
          </div>
          {addError && (
            <p className="mt-2 text-xs text-destructive">{addError}</p>
          )}
        </CardContent>
      </Card>

      {/* Trigger fill */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleFill}
          disabled={isPending}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
          检查超时并填充
        </Button>
        {fillResult && (
          <span className="text-xs text-muted-foreground">{fillResult}</span>
        )}
      </div>

      {/* User list */}
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">加载中...</div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="mb-3 h-8 w-8 opacity-40" />
          <p className="text-sm">暂无候补用户</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => {
            const config = STATUS_CONFIG[user.status] ?? STATUS_CONFIG.INACTIVE;
            return (
              <Card key={user.id} size="sm">
                <CardContent className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${config.className}`}>
                      {config.label}
                    </span>
                    <div>
                      <span className="text-sm font-medium">
                        {user.user.name || user.user.username}
                      </span>
                      {user.note && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({user.note})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.matchedAt && (
                      <span className="text-xs text-muted-foreground">
                        匹配于 {new Date(user.matchedAt).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                    {user.status === 'AVAILABLE' && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleRemove(user.userId)}
                        disabled={isPending}
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
  );
}
