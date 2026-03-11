'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActivityStatus } from '@prisma/client';

type Tag = { id: string; name: string };

type Activity = {
  id: string;
  title: string;
  capacity: number;
  status: ActivityStatus;
  type: { id: string; name: string };
  activityTags: { tag: Tag }[];
  _count: { memberships: number };
  isEligible: boolean;
  isMember?: boolean;
  memberRole?: string | null;
};

type Props = {
  activity: Activity;
  onClick: () => void;
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-primary/10 text-primary',
  FULL: 'bg-muted text-muted-foreground',
  SCHEDULED: 'bg-accent text-accent-foreground',
  IN_PROGRESS: 'bg-secondary text-secondary-foreground',
};

const STATUS_KEYS: Record<string, string> = {
  OPEN: 'statusOpen',
  FULL: 'statusFull',
  SCHEDULED: 'statusScheduled',
  IN_PROGRESS: 'statusInProgress',
  COMPLETED: 'statusCompleted',
};

export function ActivityCard({ activity, onClick }: Props) {
  const t = useTranslations('activities');
  const isLocked = !activity.isEligible;

  return (
    <Card
      className={`cursor-pointer transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring outline-none ${isLocked ? 'opacity-50' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      tabIndex={0}
      role="button"
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="line-clamp-1 text-base">{activity.title}</CardTitle>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[activity.status] ?? ''}`}
          >
            {t(STATUS_KEYS[activity.status] ?? 'statusOpen')}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{activity.type.name}</p>
      </CardHeader>
      <CardContent>
        {/* Tags */}
        {activity.activityTags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
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

        {/* Member count */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t('members', { current: activity._count.memberships, capacity: activity.capacity })}
          </span>
          {isLocked && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              {t('locked')}
            </span>
          )}
          {activity.isMember && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              {activity.memberRole === 'LEADER' ? t('leader') : t('joined')}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
