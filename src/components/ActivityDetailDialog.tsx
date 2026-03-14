'use client';

import { useState, useEffect, useActionState, useTransition, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useChat, type ActivityCommentData } from '@/components/chat/ChatProvider';
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
import { Users, UserCheck, FileText, Paperclip, Download, Trash2, Upload } from 'lucide-react';
import { deleteMeetingMinutes, getMeetingMinutes } from '@/server/actions/meetingMinutes';

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
  meetingMinutes?: MeetingMinutesData[];
};

type MeetingMinutesData = {
  id: string;
  content: string | null;
  fileName: string | null;
  fileUrl: string | null;
  fileSize: number | null;
  fileMimeType: string | null;
  createdAt: string;
  user: { id: string; name: string | null; username: string };
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

          {/* Side-by-side: Members/VirtualGroup + Activity Guide */}
          {(() => {
            const hasGuide = !!(activity.type.guideContent || activity.guideMarkdown);
            const hasMemberSection = hasVirtualGroup || (activity.members && activity.members.length > 0);
            if (!hasMemberSection && !hasGuide) return null;
            const useTwoCols = hasMemberSection && hasGuide;
            return (
              <div className="border-t pt-3">
                <div className={`grid gap-4 ${useTwoCols ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {/* Left column: Members */}
                  {hasVirtualGroup && currentUserId ? (
                    <VirtualGroupInfo
                      group={activity.virtualGroup!}
                      currentUserId={currentUserId}
                    />
                  ) : activity.members && activity.members.length > 0 ? (
                    <div>
                      <h3 className="mb-2 text-sm font-medium">{t('joinedMembers')}</h3>
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
                    </div>
                  ) : null}

                  {/* Right column: Activity guide */}
                  {hasGuide && (
                    <ActivityGuideView
                      guideContent={activity.type.guideContent}
                      guideMarkdown={activity.guideMarkdown}
                      allowView={activity.isEligible || activity.type.allowViewLocked !== false}
                    />
                  )}
                </div>
              </div>
            );
          })()}

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

          {/* Meeting Minutes for joined members (instance-scoped) */}
          {showInstanceFeatures && (
            <div className="border-t pt-4">
              <MeetingMinutesSection
                activityId={activity.id}
                currentUserId={currentUserId ?? ''}
                initialMinutes={activity.meetingMinutes ?? []}
              />
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
  const commentListRef = useRef<HTMLDivElement>(null);

  const {
    isConnected,
    joinActivity,
    leaveActivity,
    subscribeActivityComment,
    unsubscribeActivityComment,
  } = useChat();

  // Load initial comments from DB
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

  // Join/leave activity WS room & subscribe to real-time comments
  const handleNewComment = useCallback(
    (comment: ActivityCommentData) => {
      setComments((prev) => {
        // Deduplicate by comment ID
        if (prev.some((c) => c.id === comment.id)) return prev;
        return [...prev, comment];
      });
      // Auto-scroll to bottom
      setTimeout(() => {
        commentListRef.current?.scrollTo({
          top: commentListRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 50);
    },
    [],
  );

  useEffect(() => {
    if (!isConnected) return;

    joinActivity(activityId);
    subscribeActivityComment(activityId, handleNewComment);

    return () => {
      leaveActivity(activityId);
      unsubscribeActivityComment(activityId, handleNewComment);
    };
  }, [activityId, isConnected, joinActivity, leaveActivity, subscribeActivityComment, unsubscribeActivityComment, handleNewComment]);

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
        // If WS is not connected, fallback to manual re-fetch
        if (!isConnected) {
          const data = await getActivityComments(activityId);
          setComments(
            data.map((c) => ({
              ...c,
              createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
            })),
          );
        }
      }
    });
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium">{t('groupComments')}</h3>

      {/* Comment list */}
      <div ref={commentListRef} className="mb-3 max-h-48 space-y-2 overflow-y-auto">
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

const MEETING_MINUTES_ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/json',
  'text/yaml',
  'application/x-yaml',
  'image/jpeg',
  'image/png',
  'image/webp',
];
const MEETING_MINUTES_MAX_SIZE = 20 * 1024 * 1024; // 20MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MeetingMinutesSection({
  activityId,
  currentUserId,
  initialMinutes,
}: {
  activityId: string;
  currentUserId: string;
  initialMinutes: MeetingMinutesData[];
}) {
  const t = useTranslations('activities');
  const tCommon = useTranslations('common');
  const [minutes, setMinutes] = useState<MeetingMinutesData[]>(initialMinutes);
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!MEETING_MINUTES_ALLOWED_TYPES.includes(file.type)) {
      setError(t('minutesInvalidFileType'));
      e.target.value = '';
      return;
    }
    if (file.size > MEETING_MINUTES_MAX_SIZE) {
      setError(t('minutesFileTooLarge'));
      e.target.value = '';
      return;
    }

    setError(null);
    setSelectedFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && !selectedFile) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set('activityId', activityId);
      if (content.trim()) formData.set('content', content.trim());
      if (selectedFile) formData.set('file', selectedFile);

      const res = await fetch('/api/upload/meeting-minutes', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Upload failed');
      }

      // Refresh list
      const updated = await getMeetingMinutes(activityId);
      setMinutes(
        updated.map((m) => ({
          ...m,
          createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
        })),
      );
      setContent('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(minutesId: string) {
    if (!confirm(t('minutesDeleteConfirm'))) return;
    setIsDeleting(minutesId);
    try {
      const result = await deleteMeetingMinutes(minutesId);
      if (result.success) {
        setMinutes((prev) => prev.filter((m) => m.id !== minutesId));
      }
    } finally {
      setIsDeleting(null);
    }
  }

  function getDownloadUrl(m: MeetingMinutesData): string {
    if (!m.fileUrl) return '#';
    const filename = m.fileUrl.split('/').pop() || '';
    return `/api/files/meeting-minutes/${activityId}/${filename}`;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <FileText className="size-4" />
          {t('meetingMinutes')}
        </h3>
        {!showForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(true)}
            className="h-7 text-xs"
          >
            {t('addMinutes')}
          </Button>
        )}
      </div>

      {/* Minutes list */}
      <div className="mb-3 max-h-64 space-y-2 overflow-y-auto">
        {minutes.length === 0 && !showForm ? (
          <p className="text-xs text-muted-foreground">{t('noMinutesYet')}</p>
        ) : (
          minutes.map((m) => (
            <div key={m.id} className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">
                  {m.user.name ?? m.user.username}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.createdAt).toLocaleString()}
                  </span>
                  {m.user.id === currentUserId && (
                    <button
                      onClick={() => handleDelete(m.id)}
                      disabled={isDeleting === m.id}
                      className="ml-1 rounded p-0.5 text-muted-foreground hover:text-red-600 disabled:opacity-50"
                      title={t('deleteMinutes')}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {m.content && (
                <p className="mt-1.5 whitespace-pre-wrap text-sm">{m.content}</p>
              )}
              {m.fileName && m.fileUrl && (
                <div className="mt-2 flex items-center gap-2 rounded bg-muted/50 px-2 py-1.5">
                  <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{m.fileName}</span>
                  {m.fileSize && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      ({formatFileSize(m.fileSize)})
                    </span>
                  )}
                  <a
                    href={getDownloadUrl(m)}
                    download={m.fileName}
                    className="shrink-0 rounded p-0.5 text-primary hover:text-primary/80"
                    title={t('download')}
                  >
                    <Download className="size-3.5" />
                  </a>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('minutesContentPlaceholder')}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            rows={3}
          />
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
              <Upload className="size-3.5" />
              {t('uploadFile')}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.json,.yaml,.yml,.jpg,.jpeg,.png,.webp"
              />
            </label>
            {selectedFile && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Paperclip className="size-3" />
                {selectedFile.name}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="ml-0.5 text-red-500 hover:text-red-700"
                >
                  x
                </button>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || (!content.trim() && !selectedFile)}
            >
              {isSubmitting ? t('minutesSubmitting') : t('minutesSubmit')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setContent('');
                setSelectedFile(null);
                setError(null);
              }}
            >
              {tCommon('cancel')}
            </Button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>
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
