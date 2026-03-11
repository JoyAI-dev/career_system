'use client';

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
};

type Props = {
  activity: Activity;
  onClick: () => void;
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-800',
  FULL: 'bg-yellow-100 text-yellow-800',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
};

export function ActivityCard({ activity, onClick }: Props) {
  const isLocked = !activity.isEligible;

  return (
    <Card
      className={`cursor-pointer transition-shadow hover:shadow-md ${isLocked ? 'opacity-50' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="line-clamp-1 text-base">{activity.title}</CardTitle>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[activity.status] ?? ''}`}
          >
            {activity.status === 'IN_PROGRESS' ? 'In Progress' : activity.status}
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
            Members: {activity._count.memberships}/{activity.capacity}
          </span>
          {isLocked && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              Locked
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
