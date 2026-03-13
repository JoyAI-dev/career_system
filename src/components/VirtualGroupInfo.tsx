'use client';

/**
 * VirtualGroupInfo
 * Shows group leader, member list, and group status.
 * Used inside ActivityDetailDialog for GROUP_6, PAIR_2, and CROSS_GROUP activities.
 */

import { Crown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface VirtualGroupInfoProps {
  group: {
    id: string;
    name: string | null;
    status: string;
    leaderId: string | null;
    leader: { id: string; name: string | null; username: string } | null;
    members: Array<{
      userId: string;
      order: number;
      user: { id: string; name: string | null; username: string };
    }>;
  };
  currentUserId: string;
}

const STATUS_COLORS: Record<string, string> = {
  FORMING: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
};

const STATUS_LABELS: Record<string, string> = {
  FORMING: '组建中',
  ACTIVE: '活跃',
  COMPLETED: '已完成',
};

function getInitials(name: string | null, username: string): string {
  if (name) return name.slice(0, 1).toUpperCase();
  return username.slice(0, 1).toUpperCase();
}

export function VirtualGroupInfo({ group, currentUserId }: VirtualGroupInfoProps) {
  return (
    <div className="rounded-lg border p-3">
      {/* Header: Group name + status */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {group.name ?? '我的小组'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {group.members.length} 成员
          </span>
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-xs font-medium',
              STATUS_COLORS[group.status] ?? 'bg-muted text-muted-foreground',
            )}
          >
            {STATUS_LABELS[group.status] ?? group.status}
          </span>
        </div>
      </div>

      {/* Member list */}
      <ul className="space-y-1.5">
        {group.members.map((member) => {
          const isLeader = member.userId === group.leaderId;
          const isCurrentUser = member.userId === currentUserId;
          const displayName = member.user.name ?? member.user.username;

          return (
            <li
              key={member.userId}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1 text-sm',
                isCurrentUser && 'bg-primary/5',
              )}
            >
              <Avatar size="sm">
                <AvatarFallback>
                  {getInitials(member.user.name, member.user.username)}
                </AvatarFallback>
              </Avatar>
              <span className={cn(isCurrentUser && 'font-medium')}>
                {displayName}
                {isCurrentUser && ' (我)'}
              </span>
              {isLeader && (
                <Crown className="size-3.5 text-amber-500" />
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                #{member.order}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
