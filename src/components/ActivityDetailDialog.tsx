'use client';

import ReactMarkdown from 'react-markdown';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ActivityStatus } from '@prisma/client';

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
};

export function ActivityDetailDialog({ activity, onClose }: Props) {
  if (!activity) return null;

  const isLocked = !activity.isEligible;
  const isFull = activity._count.memberships >= activity.capacity;
  const canJoin = activity.isEligible && activity.status === 'OPEN' && !isFull;

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

          {/* Markdown guide */}
          {activity.guideMarkdown && (
            <div className="border-t pt-4">
              <h3 className="mb-2 text-sm font-medium">Activity Guide</h3>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{activity.guideMarkdown}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            disabled={!canJoin}
            title={
              isLocked
                ? 'Complete prerequisite to unlock'
                : isFull
                  ? 'Activity is full'
                  : activity.status !== 'OPEN'
                    ? 'Activity is not open for joining'
                    : 'Join this activity'
            }
          >
            {isLocked ? 'Locked' : isFull ? 'Full' : 'Join'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
