'use client';

import { useState, useActionState, useTransition } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  leaveActivity,
  scheduleMeeting,
  startMeeting,
  completeMeeting,
  type ActionState,
} from '@/server/actions/activity';
import { getAvailableActions, getActionLabel, type TransitionAction } from '@/server/stateMachine';
import type { ActivityStatus, MemberRole } from '@prisma/client';

type Tag = { id: string; name: string };

type Activity = {
  id: string;
  title: string;
  capacity: number;
  status: ActivityStatus;
  guideMarkdown: string | null;
  isOnline: boolean;
  location: string | null;
  scheduledAt: string | null;
  type: { id: string; name: string };
  activityTags: { tag: Tag }[];
  _count: { memberships: number };
  isEligible: boolean;
  isMember?: boolean;
  memberRole?: string;
};

type Props = {
  activity: Activity | null;
  onClose: () => void;
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-800',
  FULL: 'bg-yellow-100 text-yellow-800',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
};

export function ActivityDetailDialog({ activity, onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  if (!activity) return null;

  const isLocked = !activity.isEligible;
  const isFull = activity._count.memberships >= activity.capacity;
  const canJoin = activity.isEligible && activity.status === 'OPEN' && !isFull && !activity.isMember;
  const canLeave = activity.isMember && activity.status === 'OPEN';

  const userRole = activity.memberRole as MemberRole | undefined;
  const availableActions = getAvailableActions(activity.status, userRole ?? null);

  function handleJoin() {
    setError(null);
    startTransition(async () => {
      const result = await joinActivity(activity!.id);
      if (result.errors?._form) {
        setError(result.errors._form[0]);
      } else {
        onClose();
      }
    });
  }

  function handleLeave() {
    if (!confirm('Are you sure you want to leave this activity?')) return;
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

  function handleAction(action: TransitionAction) {
    if (action === 'SCHEDULE') {
      setShowScheduleForm(true);
      return;
    }
    const confirmMsg = action === 'START'
      ? 'Start this meeting now?'
      : 'Mark this meeting as completed?';
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
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
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
              {activity.status === 'IN_PROGRESS' ? 'In Progress' : activity.status}
            </span>
            {activity.isMember && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                {activity.memberRole === 'LEADER' ? 'Leader' : 'Joined'}
              </span>
            )}
          </div>

          {/* Details */}
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              Members: {activity._count.memberships}/{activity.capacity}
            </p>
            {activity.location && <p>Location: {activity.location}</p>}
            {activity.isOnline && <p>Online activity</p>}
            {activity.scheduledAt && (
              <p>Scheduled: {new Date(activity.scheduledAt).toLocaleString()}</p>
            )}
          </div>

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
              This activity is locked. Complete the prerequisite activity type to unlock.
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

          {/* Markdown guide */}
          {activity.guideMarkdown && (
            <div className="border-t pt-4">
              <h3 className="mb-2 text-sm font-medium">Activity Guide</h3>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{activity.guideMarkdown}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Post-completion questionnaire update prompt */}
          {activity.status === 'COMPLETED' && activity.isMember && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <h3 className="mb-1 text-sm font-medium text-primary">Update Your Cognitive Profile</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Reflect on what you learned from this activity and update your questionnaire answers.
              </p>
              <Link href={`/questionnaire-update?activityId=${activity.id}`}>
                <Button size="sm">Update Questionnaire</Button>
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
                  {isPending ? '...' : getActionLabel(action)}
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
              {isPending ? 'Leaving...' : 'Leave'}
            </Button>
          ) : !activity.isMember && !isLocked ? (
            <Button
              onClick={handleJoin}
              disabled={!canJoin || isPending}
              title={
                isFull
                  ? 'Activity is full'
                  : activity.status !== 'OPEN'
                    ? 'Activity is not open for joining'
                    : 'Join this activity'
              }
            >
              {isPending
                ? 'Joining...'
                : isFull
                  ? 'Full'
                  : activity.status !== 'OPEN'
                    ? activity.status
                    : 'Join'}
            </Button>
          ) : isLocked ? (
            <Button disabled>Locked</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      <h3 className="mb-3 text-sm font-medium">Schedule Meeting</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="scheduledAt">Date & Time</Label>
          <Input
            id="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
            required
          />
        </div>
        <div>
          <Label htmlFor="schedule-location">Location</Label>
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
          <Label htmlFor="schedule-isOnline">Online meeting</Label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? 'Scheduling...' : 'Confirm Schedule'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
