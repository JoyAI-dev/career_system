'use client';

/**
 * PairingPanel
 * Shows pairing status and allows pairing operations.
 * Used inside ActivityDetailDialog for PAIR_2 activities.
 */

import { useState, useTransition } from 'react';
import {
  requestPairing,
  acceptPairingRequest,
  dissolvePairingAction,
  autoPairGroupAction,
} from '@/server/actions/pairingActions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Handshake, Shuffle, UserCheck, X } from 'lucide-react';

interface PairingPanelProps {
  virtualGroupId: string;
  activityTypeId: string;
  currentUserId: string;
  isLeader: boolean;
  pairingMode: string | null;
  members: Array<{
    userId: string;
    user: { id: string; name: string | null; username: string };
  }>;
  pairings: Array<{
    id: string;
    status: string;
    user1: { id: string; name: string | null; username: string };
    user2: { id: string; name: string | null; username: string };
  }>;
  onPairingChange: () => void;
}

const PAIRING_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  DISSOLVED: 'bg-gray-100 text-gray-800',
};

const PAIRING_STATUS_LABELS: Record<string, string> = {
  PENDING: '待确认',
  ACCEPTED: '已配对',
  DISSOLVED: '已解散',
};

function displayName(user: { name: string | null; username: string }): string {
  return user.name ?? user.username;
}

export function PairingPanel({
  virtualGroupId,
  activityTypeId,
  currentUserId,
  isLeader,
  pairingMode,
  members,
  pairings,
  onPairingChange,
}: PairingPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectingPartner, setSelectingPartner] = useState(false);

  // Filter active pairings (not dissolved)
  const activePairings = pairings.filter((p) => p.status !== 'DISSOLVED');

  // Find paired user IDs
  const pairedUserIds = new Set<string>();
  activePairings.forEach((p) => {
    pairedUserIds.add(p.user1.id);
    pairedUserIds.add(p.user2.id);
  });

  // Unpaired members
  const unpairedMembers = members.filter((m) => !pairedUserIds.has(m.userId));

  // Current user's pairing
  const myPairing = activePairings.find(
    (p) => p.user1.id === currentUserId || p.user2.id === currentUserId,
  );

  // Progress
  const totalPairs = Math.floor(members.length / 2);
  const completedPairs = activePairings.filter((p) => p.status === 'ACCEPTED').length;

  // Can select partner?
  const canSelfSelect =
    !myPairing &&
    (pairingMode === 'SELF_SELECT' || pairingMode === 'SELF_SELECT_WITH_LEADER');

  function handleRequestPairing(partnerId: string) {
    setError(null);
    startTransition(async () => {
      const result = await requestPairing(virtualGroupId, activityTypeId, partnerId);
      if (result.errors?._form) {
        setError(result.errors._form[0]);
      } else {
        setSelectingPartner(false);
        onPairingChange();
      }
    });
  }

  function handleAccept(pairingId: string) {
    setError(null);
    startTransition(async () => {
      const result = await acceptPairingRequest(pairingId);
      if (result.errors?._form) {
        setError(result.errors._form[0]);
      } else {
        onPairingChange();
      }
    });
  }

  function handleDissolve(pairingId: string) {
    setError(null);
    startTransition(async () => {
      const result = await dissolvePairingAction(pairingId);
      if (result.errors?._form) {
        setError(result.errors._form[0]);
      } else {
        onPairingChange();
      }
    });
  }

  function handleAutoPair() {
    setError(null);
    startTransition(async () => {
      const result = await autoPairGroupAction(virtualGroupId, activityTypeId);
      if (result.errors?._form) {
        setError(result.errors._form[0]);
      } else {
        onPairingChange();
      }
    });
  }

  return (
    <div className="rounded-lg border p-3">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Handshake className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">搭子配对</span>
        </div>
        <span className="text-xs text-muted-foreground">
          已配对 {completedPairs}/{totalPairs} 组
        </span>
      </div>

      {/* Current pairings */}
      {activePairings.length > 0 && (
        <ul className="mb-3 space-y-2">
          {activePairings.map((pairing) => {
            const isMyPairing =
              pairing.user1.id === currentUserId ||
              pairing.user2.id === currentUserId;
            const needsAcceptance =
              pairing.status === 'PENDING' && isMyPairing;
            return (
              <li
                key={pairing.id}
                className={cn(
                  'flex items-center justify-between rounded-md border px-2 py-1.5 text-sm',
                  isMyPairing && 'border-primary/30 bg-primary/5',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span>{displayName(pairing.user1)}</span>
                  <Handshake className="size-3 text-muted-foreground" />
                  <span>{displayName(pairing.user2)}</span>
                  <span
                    className={cn(
                      'ml-1 rounded px-1 py-0.5 text-xs font-medium',
                      PAIRING_STATUS_COLORS[pairing.status] ?? '',
                    )}
                  >
                    {PAIRING_STATUS_LABELS[pairing.status] ?? pairing.status}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {needsAcceptance && pairing.status === 'PENDING' && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => handleAccept(pairing.id)}
                      disabled={isPending}
                    >
                      <UserCheck className="size-3" />
                      接受
                    </Button>
                  )}
                  {isLeader && pairing.status !== 'DISSOLVED' && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDissolve(pairing.id)}
                      disabled={isPending}
                    >
                      <X className="size-3" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Unpaired members */}
      {unpairedMembers.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs text-muted-foreground">
            未配对成员 ({unpairedMembers.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unpairedMembers.map((m) => {
              const isMe = m.userId === currentUserId;
              return (
                <span
                  key={m.userId}
                  className={cn(
                    'rounded-md border px-2 py-0.5 text-xs',
                    isMe ? 'border-primary/30 bg-primary/5 font-medium' : 'bg-muted/50',
                  )}
                >
                  {displayName(m.user)}
                  {isMe && ' (我)'}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Select partner UI */}
      {canSelfSelect && !selectingPartner && (
        <Button
          variant="outline"
          size="sm"
          className="mb-2 w-full"
          onClick={() => setSelectingPartner(true)}
          disabled={isPending}
        >
          选择搭子
        </Button>
      )}

      {canSelfSelect && selectingPartner && (
        <div className="mb-2 rounded-md border border-primary/20 bg-primary/5 p-2">
          <p className="mb-2 text-xs font-medium">选择你的搭子:</p>
          <div className="flex flex-wrap gap-1.5">
            {unpairedMembers
              .filter((m) => m.userId !== currentUserId)
              .map((m) => (
                <Button
                  key={m.userId}
                  variant="outline"
                  size="xs"
                  onClick={() => handleRequestPairing(m.userId)}
                  disabled={isPending}
                >
                  {displayName(m.user)}
                </Button>
              ))}
          </div>
          <Button
            variant="ghost"
            size="xs"
            className="mt-1.5"
            onClick={() => setSelectingPartner(false)}
          >
            取消
          </Button>
        </div>
      )}

      {/* Leader auto-pair button */}
      {isLeader && unpairedMembers.length >= 2 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleAutoPair}
          disabled={isPending}
        >
          <Shuffle className="size-3.5" />
          {isPending ? '配对中...' : '自动配对剩余成员'}
        </Button>
      )}

      {/* Error */}
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
