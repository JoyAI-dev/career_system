'use client';

/**
 * VirtualGroupAdmin
 * Admin view for virtual groups within a community.
 * Displayed when drilling into a community in the CommunityManager.
 */

import { useState, useTransition } from 'react';
import { Users, Crown, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  adminFillGroupWithStandby,
  reassignGroupLeader,
} from '@/server/actions/virtualGroup';

// ── Types ──────────────────────────────────────────────────────────

type VirtualGroupMember = {
  id: string;
  userId: string;
  order: number;
  user: { id: string; name: string | null; username: string };
};

type GroupActivity = {
  id: string;
  title: string;
  status: string;
  type: { id: string; name: string; scope: string };
  memberships: { userId: string; completedAt: string | null }[];
};

type VirtualGroup = {
  id: string;
  name: string | null;
  status: string;
  leaderId: string | null;
  createdAt: string;
  leader: { id: string; name: string | null; username: string } | null;
  members: VirtualGroupMember[];
  activities: GroupActivity[];
};

type Props = {
  communityId: string;
  communityLabel: string;
  groups: VirtualGroup[];
  onRefresh: () => void;
};

// ── Status config ──────────────────────────────────────────────────

const GROUP_STATUS: Record<string, { label: string; className: string }> = {
  FORMING: { label: '组建中', className: 'bg-yellow-100 text-yellow-700' },
  ACTIVE: { label: '活跃', className: 'bg-green-100 text-green-700' },
  COMPLETED: { label: '已完成', className: 'bg-gray-100 text-gray-500' },
};

const ACTIVITY_STATUS: Record<string, { label: string; className: string }> = {
  OPEN: { label: '开放', className: 'bg-blue-100 text-blue-700' },
  FULL: { label: '满员', className: 'bg-yellow-100 text-yellow-700' },
  SCHEDULED: { label: '已安排', className: 'bg-purple-100 text-purple-700' },
  IN_PROGRESS: { label: '进行中', className: 'bg-green-100 text-green-700' },
  COMPLETED: { label: '已完成', className: 'bg-gray-100 text-gray-500' },
  CANCELLED: { label: '已取消', className: 'bg-red-100 text-red-500' },
};

// ── Component ──────────────────────────────────────────────────────

export function VirtualGroupAdmin({ communityLabel, groups, onRefresh }: Props) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Users className="mb-3 h-8 w-8 opacity-40" />
        <p className="text-sm">该社区暂无虚拟小组</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {communityLabel} - 共 {groups.length} 个小组
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          刷新
        </Button>
      </div>

      {groups.map((group) => (
        <GroupCard
          key={group.id}
          group={group}
          isExpanded={expandedGroup === group.id}
          onToggle={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}

// ── Group Card ─────────────────────────────────────────────────────

function GroupCard({
  group,
  isExpanded,
  onToggle,
  onRefresh,
}: {
  group: VirtualGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const statusConfig = GROUP_STATUS[group.status] ?? GROUP_STATUS.FORMING;

  function handleFillWithStandby() {
    setError(null);
    startTransition(async () => {
      const result = await adminFillGroupWithStandby(group.id);
      if (result.errors) {
        setError(result.errors._form?.[0] ?? '操作失败');
      } else {
        onRefresh();
      }
    });
  }

  function handleReassignLeader(newLeaderId: string) {
    setError(null);
    startTransition(async () => {
      const result = await reassignGroupLeader(group.id, newLeaderId);
      if (result.errors) {
        setError(result.errors._form?.[0] ?? '操作失败');
      } else {
        onRefresh();
      }
    });
  }

  return (
    <Card size="sm">
      <CardContent className="py-3">
        {/* Header row */}
        <div
          className="flex cursor-pointer items-center justify-between"
          onClick={onToggle}
        >
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusConfig.className}`}>
              {statusConfig.label}
            </span>
            <span className="text-sm font-medium">
              {group.name ?? `小组 #${group.id.slice(-4)}`}
            </span>
            <span className="text-xs text-muted-foreground">
              ({group.members.length} 人)
            </span>
            {group.leader && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Crown className="h-3 w-3 text-yellow-500" />
                {group.leader.name || group.leader.username}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {group.status === 'FORMING' && (
              <Button
                variant="outline"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFillWithStandby();
                }}
                disabled={isPending}
              >
                候补填充
              </Button>
            )}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {error && (
          <p className="mt-2 text-xs text-destructive">{error}</p>
        )}

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-3 space-y-3 border-t pt-3">
            {/* Members */}
            <div>
              <Label className="text-xs font-medium">成员列表</Label>
              <div className="mt-1 space-y-1">
                {group.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {member.userId === group.leaderId && (
                        <Crown className="h-3 w-3 text-yellow-500" />
                      )}
                      <span>{member.user.name || member.user.username}</span>
                      <span className="text-xs text-muted-foreground">#{member.order}</span>
                    </div>
                    {member.userId !== group.leaderId && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleReassignLeader(member.userId)}
                        disabled={isPending}
                        className="text-xs"
                      >
                        设为组长
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Activities */}
            {group.activities.length > 0 && (
              <div>
                <Label className="text-xs font-medium">关联活动</Label>
                <div className="mt-1 space-y-1">
                  {group.activities.map((activity) => {
                    const actStatus = ACTIVITY_STATUS[activity.status] ?? ACTIVITY_STATUS.OPEN;
                    const completedCount = activity.memberships.filter((m) => m.completedAt).length;
                    return (
                      <div key={activity.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`rounded px-1 py-0.5 text-[10px] font-medium ${actStatus.className}`}>
                            {actStatus.label}
                          </span>
                          <span>{activity.type.name}</span>
                          <span className="text-xs text-muted-foreground">{activity.title}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {completedCount}/{activity.memberships.length} 完成
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
