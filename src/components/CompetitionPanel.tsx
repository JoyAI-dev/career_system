'use client';

/**
 * CompetitionPanel
 * Shows competition status, opponent group, and winner selection.
 * Used inside ActivityDetailDialog for CROSS_GROUP activities.
 */

import { useState, useTransition } from 'react';
import { setCompetitionWinnerAction } from '@/server/actions/activity';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Swords, Trophy, Loader2 } from 'lucide-react';

interface CompetitionPanelProps {
  activityId: string;
  activityStatus: string;
  winnerId: string | null;
  currentGroupId: string | null;
  isLeader: boolean;
  currentUserId: string;
  opponentGroup?: {
    id: string;
    name: string | null;
    members: Array<{ user: { name: string | null; username: string } }>;
  } | null;
  hasCompetitor: boolean;
  onWinnerSet: () => void;
}

export function CompetitionPanel({
  activityId,
  winnerId,
  currentGroupId,
  isLeader,
  opponentGroup,
  hasCompetitor,
  onWinnerSet,
}: CompetitionPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSetWinner(groupId: string) {
    setError(null);
    startTransition(async () => {
      const result = await setCompetitionWinnerAction(activityId, groupId);
      if (result.errors?._form) {
        setError(result.errors._form[0]);
      } else {
        onWinnerSet();
      }
    });
  }

  // Determine winner display
  const isOurWin = winnerId && currentGroupId && winnerId === currentGroupId;
  const isTheirWin = winnerId && currentGroupId && winnerId !== currentGroupId;

  return (
    <div className="rounded-lg border p-3">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Swords className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">跨组竞赛</span>
      </div>

      {/* Waiting for opponent */}
      {!hasCompetitor && (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          等待对手匹配...
        </div>
      )}

      {/* Opponent matched */}
      {hasCompetitor && opponentGroup && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            对手小组
          </p>
          <div className="rounded-md border border-red-200 bg-red-50/50 px-3 py-2">
            <p className="text-sm font-medium">
              {opponentGroup.name ?? '对方小组'}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {opponentGroup.members.map((m, i) => (
                <span
                  key={i}
                  className="rounded bg-red-100/50 px-1.5 py-0.5 text-xs text-red-800"
                >
                  {m.user.name ?? m.user.username}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Winner display */}
      {winnerId && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
            isOurWin
              ? 'bg-green-50 text-green-800'
              : 'bg-amber-50 text-amber-800',
          )}
        >
          <Trophy className="size-4" />
          {isOurWin ? '我们赢了!' : isTheirWin ? '对方获胜' : '已决出胜者'}
        </div>
      )}

      {/* Winner selection (leader only, no winner yet, has competitor) */}
      {isLeader && !winnerId && hasCompetitor && currentGroupId && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">设置获胜者:</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => handleSetWinner(currentGroupId)}
              disabled={isPending}
            >
              <Trophy className="size-3.5" />
              {isPending ? '...' : '选择我们'}
            </Button>
            {opponentGroup && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleSetWinner(opponentGroup.id)}
                disabled={isPending}
              >
                {isPending ? '...' : '选择对方'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
