'use client';

import { useState, useEffect, useActionState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  joinActivity,
  joinActivityType,
  leaveActivity,
  scheduleMeeting,
  startMeeting,
  completeMeeting,
  finishActivity,
  addActivityComment,
  getActivityComments,
  type ActionState,
} from '@/server/actions/activity';
import { getAvailableActions, type TransitionAction } from '@/server/stateMachine';
import type { ActivityStatus, MemberRole } from '@prisma/client';
import { VirtualGroupInfo } from '@/components/VirtualGroupInfo';
import { PairingPanel } from '@/components/PairingPanel';
import { CompetitionPanel } from '@/components/CompetitionPanel';
import { ActivityGuideView } from '@/components/ActivityGuideView';
import { Users, UserCheck } from 'lucide-react';

type Tag = { id: string; name: string };

type VirtualGroupData = {
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

type PairingData = {
  id: string;
  status: string;
  user1: { id: string; name: string | null; username: string };
  user2: { id: string; name: string | null; username: string };
};

type OpponentGroupData = {
  id: string;
  name: string | null;
  members: Array<{ user: { name: string | null; username: string } }>;
};

type Activity = {
  id: string;
  title: string;
  capacity: number;
  status: ActivityStatus;
  guideMarkdown: string | null;
  isOnline: boolean;
  location: string | null;
  scheduledAt: string | null;
  type: {
    id: string;
    name: string;
    scope?: string;
    completionMode?: string;
    pairingMode?: string | null;
    guideContent?: string | null;
    allowViewLocked?: boolean;
  };
  activityTags: { tag: Tag }[];
  _count: { memberships: number };
  isEligible: boolean;
  isMember?: boolean;
  memberRole?: string;
  memberCompletedAt?: string | null;
  members?: { username: string; name: string | null; role?: string }[];
  // New optional fields for community features
  virtualGroup?: VirtualGroupData | null;
  virtualGroupId?: string | null;
  competitorActivityId?: string | null;
  winnerId?: string | null;
  pairings?: PairingData[];
  opponentGroup?: OpponentGroupData | null;
};

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string | null; username: string };
};

type Props = {
  activity: Activity | null;
  onClose: () => void;
  /** When true, join calls joinActivityType(type.id) instead of joinActivity(id) */
  joinByType?: boolean;
  /** Current user ID, needed for virtual group / pairing features */
  currentUserId?: string;
  /** Callback to refresh parent data after pairing/competition changes */
  onRefresh?: () => void;
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-800',
  FULL: 'bg-yellow-100 text-yellow-800',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
};

const STATUS_KEYS: Record<string, string> = {
  OPEN: 'statusOpen',
  FULL: 'statusFull',
  SCHEDULED: 'statusScheduled',
  IN_PROGRESS: 'statusInProgress',
  COMPLETED: 'statusCompleted',
};

const ACTION_KEYS: Record<string, string> = {
  SCHEDULE: 'scheduleMeeting',
  START: 'startMeeting',
  COMPLETE: 'completeMeeting',
};

const FINISHABLE_STATUSES: ActivityStatus[] = ['FULL', 'COMPLETED'];

export function ActivityDetailDialog({ activity, onClose, joinByType, currentUserId, onRefresh }: Props) {
  const t = useTranslations('activities');
  const tCommon = useTranslations('common');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  if (!activity) return null;

  const isLocked = !activity.isEligible;
  const isFull = activity._count.memberships >= activity.capacity;

  // Community feature helpers
  const scope = activity.type.scope;
  const hasVirtualGroup = !!activity.virtualGroup;
  const isGroupLeader = hasVirtualGroup && currentUserId
    ? activity.virtualGroup!.leaderId === currentUserId
    : false;
  // In joinByType mode, user can always join (overflow creates new instance)
  const canJoin = joinByType
    ? activity.isEligible && !activity.isMember
    : activity.isEligible && activity.status === 'OPEN' && !isFull && !activity.isMember;
  const canLeave = !joinByType && activity.isMember && activity.status === 'OPEN';

  const userRole = activity.memberRole as MemberRole | undefined;
  // In joinByType mode, no instance-level actions (schedule/start/complete)
  const availableActions = joinByType
    ? []
    : getAvailableActions(activity.status, userRole ?? null);

  // Show instance-scoped features only when viewing an actual instance (not type-level)
  const showInstanceFeatures = !joinByType && activity.isMember;

  // Finish button: visible when instance is FULL/COMPLETED, user is member, and hasn't finished yet
  const canFinish = showInstanceFeatures
    && (FINISHABLE_STATUSES.includes(activity.status) || (activity.status === 'OPEN' && isFull))
    && !activity.memberCompletedAt;

  function handleJoin() {
    setError(null);
    startTransition(async () => {
      const result = joinByType
        ? await joinActivityType(activity!.type.id)
        : await joinActivity(activity!.id);
      if (result.errors?._form) {
        setError(result.errors._form[0]);
      } else {
        onClose();
      }
    });
  }

  function handleLeave() {
    if (!confirm(t('confirmLeave'))) return;
    setError(null);
    startTransition(async () => {
      const result = await leaveActivity(activity!.id);
      if (result.errors?._form) {
        setError(result.errors._form[0]);
      } else {
        onClose();
      }
    });
  }

  function handleFinish() {
    setError(null);
    startTransition(async () => {
      const result = await finishActivity(activity!.id);
      if (result.errors?._form) {
        setError(result.errors._form[0]);
      } else {
        onClose();
      }
    });
  }

  function handleAction(action: TransitionAction) {
    if (action === 'SCHEDULE') {
      setShowScheduleForm(true);
      return;
    }
    const confirmMsg = action === 'START'
      ? t('confirmStart')
      : t('confirmComplete');
    if (!confirm(confirmMsg)) return;

    setError(null);
    startTransition(async () => {
      const fn = action === 'START' ? startMeeting : completeMeeting;
      const result = await fn(activity!.id);
      if (result.errors?._form) {
        setError(result.errors._form[0]);
      } else {
        onClose();
      }
    });
  }

  return (
    <Dialog open={!!activity} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{activity.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded bg-muted px-2 py-0.5 font-medium">
              {activity.type.name}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[activity.status] ?? ''}`}
            >
              {t(STATUS_KEYS[activity.status] ?? 'statusOpen')}
            </span>
            {activity.isMember && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                {activity.memberRole === 'LEADER' ? t('leader') : t('joined')}
              </span>
            )}
          </div>

          {/* Details */}
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              {t('members', { current: activity._count.memberships, capacity: activity.capacity })}
            </p>
            {activity.location && <p>{t('location', { location: activity.location })}</p>}
            {activity.isOnline && <p>{t('onlineActivity')}</p>}
            {activity.scheduledAt && (
              <p>{t('scheduled', { date: new Date(activity.scheduledAt).toLocaleString() })}</p>
            )}
          </div>

          {/* Joined member list — only show when there is NO virtual group (to avoid duplication with VirtualGroupInfo) */}
          {!hasVirtualGroup && (
            <div className="border-t pt-3">
              <h3 className="mb-2 text-sm font-medium">{t('joinedMembers')}</h3>
              {activity.members && activity.members.length > 0 ? (
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {activity.members.map((m) => (
                    <li key={m.username} className="flex items-center justify-between gap-2">
                      <span>
                        {m.username}
                        {m.name ? ` (${m.name})` : ''}
                      </span>
                      {m.role === 'LEADER' && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                          {t('leader')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t('noJoinedMembers')}</p>
              )}
            </div>
          )}

          {/* Side-by-side: Virtual Group + Activity Guide */}
          {(hasVirtualGroup || activity.type.guideContent || activity.guideMarkdown) && (
            <div className="border-t pt-3">
              <div className={`grid gap-4 ${hasVirtualGroup && (activity.type.guideContent || activity.guideMarkdown) ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {/* Virtual Group Info */}
                {hasVirtualGroup && currentUserId && (
                  <VirtualGroupInfo
                    group={activity.virtualGroup!}
                    currentUserId={currentUserId}
                  />
                )}

                {/* Activity guide (from ActivityType or legacy guideMarkdown) */}
                {(activity.type.guideContent || activity.guideMarkdown) && (
                  <ActivityGuideView
                    guideContent={activity.type.guideContent}
                    guideMarkdown={activity.guideMarkdown}
                    allowView={activity.isEligible || activity.type.allowViewLocked !== false}
                  />
                )}
              </div>
            </div>
          )}

          {/* Completion mode indicator */}
          {activity.type.completionMode && showInstanceFeatures && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {activity.type.completionMode === 'ALL_MEMBERS' ? (
                <>
                  <Users className="size-3.5" />
                  <span>所有成员需标记完成</span>
                </>
              ) : (
                <>
                  <UserCheck className="size-3.5" />
                  <span>组长标记完成即可</span>
                </>
              )}
            </div>
          )}

          {/* Pairing Panel (for PAIR_2 activities) */}
          {scope === 'PAIR_2' && hasVirtualGroup && currentUserId && (
            <div className="border-t pt-3">
              <PairingPanel
                virtualGroupId={activity.virtualGroup!.id}
                activityTypeId={activity.type.id}
                currentUserId={currentUserId}
                isLeader={isGroupLeader}
                pairingMode={activity.type.pairingMode ?? null}
                members={activity.virtualGroup!.members}
                pairings={activity.pairings ?? []}
                onPairingChange={onRefresh ?? (() => {})}
              />
            </div>
          )}

          {/* Competition Panel (for CROSS_GROUP activities) */}
          {scope === 'CROSS_GROUP' && currentUserId && (
            <div className="border-t pt-3">
              <CompetitionPanel
                activityId={activity.id}
                activityStatus={activity.status}
                winnerId={activity.winnerId ?? null}
                currentGroupId={activity.virtualGroupId ?? null}
                isLeader={isGroupLeader}
                currentUserId={currentUserId}
                opponentGroup={activity.opponentGroup}
                hasCompetitor={!!activity.competitorActivityId}
                onWinnerSet={onRefresh ?? (() => {})}
              />
            </div>
          )}

          {/* Tags */}
          {activity.activityTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {activity.activityTags.map(({ tag }) => (
                <span
                  key={tag.id}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Locked notice */}
          {isLocked && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
              {t('lockedNotice')}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Schedule Form (shown when leader clicks Schedule) */}
          {showScheduleForm && (
            <ScheduleForm
              activityId={activity.id}
              onSuccess={onClose}
              onError={(msg) => setError(msg)}
              onCancel={() => setShowScheduleForm(false)}
            />
          )}

          {/* Group comments for joined members (instance-scoped) */}
          {showInstanceFeatures && (
            <div className="border-t pt-4">
              <CommentSection activityId={activity.id} />
            </div>
          )}

          {/* Finish Activity button */}
          {canFinish && (
            <div className="border-t pt-4">
              <Button
                onClick={handleFinish}
                disabled={isPending}
                className="w-full"
              >
                {isPending ? t('finishing') : t('finishActivity')}
              </Button>
            </div>
          )}

          {/* Already finished badge */}
          {showInstanceFeatures
            && (FINISHABLE_STATUSES.includes(activity.status) || (activity.status === 'OPEN' && isFull))
            && activity.memberCompletedAt && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {t('alreadyFinished')}
            </div>
          )}

          {/* Questionnaire update prompt — available for all joined members */}
          {showInstanceFeatures && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <h3 className="mb-1 text-sm font-medium text-primary">{t('updateCognitiveProfile')}</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                {t('reflectOnLearning')}
              </p>
              <Link href={`/questionnaire-update?activityId=${activity.id}`}>
                <Button size="sm">{t('updateQuestionnaire')}</Button>
              </Link>
            </div>
          )}
        </div>

        <DialogFooter>
          {/* Leader actions */}
          {availableActions.length > 0 && !showScheduleForm && (
            <div className="flex gap-2">
              {availableActions.map((action) => (
                <Button
                  key={action}
                  onClick={() => handleAction(action)}
                  disabled={isPending}
                >
                  {isPending ? '...' : t(ACTION_KEYS[action] ?? 'join')}
                </Button>
              ))}
            </div>
          )}

          {/* Join/Leave */}
          {canLeave && availableActions.length === 0 ? (
            <Button
              variant="outline"
              onClick={handleLeave}
              disabled={isPending}
            >
              {isPending ? t('leaving') : t('leave')}
            </Button>
          ) : !activity.isMember && !isLocked ? (
            <Button
              onClick={handleJoin}
              disabled={!canJoin || isPending}
            >
              {isPending
                ? t('joining')
                : joinByType
                  ? t('join')
                  : isFull
                    ? t('full')
                    : activity.status !== 'OPEN'
                      ? t(STATUS_KEYS[activity.status] ?? 'statusOpen')
                      : t('join')}
            </Button>
          ) : isLocked ? (
            <Button disabled>{t('locked')}</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommentSection({ activityId }: { activityId: string }) {
  const t = useTranslations('activities');
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getActivityComments(activityId).then((data) => {
      setComments(
        data.map((c) => ({
          ...c,
          createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
        })),
      );
    });
  }, [activityId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await addActivityComment(activityId, newComment);
      if (result.errors?._form) {
        setError(result.errors._form[0]);
      } else {
        setNewComment('');
        // Refresh comments
        const data = await getActivityComments(activityId);
        setComments(
          data.map((c) => ({
            ...c,
            createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
          })),
        );
      }
    });
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium">{t('groupComments')}</h3>

      {/* Comment list */}
      <div className="mb-3 max-h-48 space-y-2 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('noComments')}</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="rounded-lg bg-muted/50 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">
                  {comment.user.name ?? comment.user.username}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-sm">{comment.content}</p>
            </div>
          ))
        )}
      </div>

      {/* Comment form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={t('commentPlaceholder')}
          className="text-sm"
        />
        <Button type="submit" size="sm" disabled={isPending || !newComment.trim()}>
          {isPending ? '...' : t('send')}
        </Button>
      </form>
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

function ScheduleForm({
  activityId,
  onSuccess,
  onError,
  onCancel,
}: {
  activityId: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('activities');
  const tCommon = useTranslations('common');
  const [state, formAction] = useActionState<ActionState, FormData>(scheduleMeeting, {});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('activityId', activityId);

    startTransition(async () => {
      const result = await scheduleMeeting({}, formData);
      if (result.errors?._form) {
        onError(result.errors._form[0]);
      } else if (result.errors) {
        const firstError = Object.values(result.errors)[0]?.[0];
        if (firstError) onError(firstError);
      } else {
        onSuccess();
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <h3 className="mb-3 text-sm font-medium">{t('scheduleMeeting')}</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="scheduledAt">{t('dateTime')}</Label>
          <Input
            id="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
            required
          />
        </div>
        <div>
          <Label htmlFor="schedule-location">{t('locationLabel')}</Label>
          <Input
            id="schedule-location"
            name="location"
            placeholder="Meeting room, address, etc."
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="schedule-isOnline"
            name="isOnline"
            value="true"
            className="size-4 rounded border-border"
          />
          <Label htmlFor="schedule-isOnline">{t('onlineMeeting')}</Label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? t('scheduling') : t('confirmSchedule')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {tCommon('cancel')}
          </Button>
        </div>
      </form>
    </div>
  );
}
