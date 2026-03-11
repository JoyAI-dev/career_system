'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { deleteActivity } from '@/server/actions/activity';
import type { ActivityStatus } from '@prisma/client';

type Activity = {
  id: string;
  title: string;
  capacity: number;
  status: ActivityStatus;
  isOnline: boolean;
  location: string | null;
  createdAt: Date;
  type: { id: string; name: string };
  creator: { id: string; name: string | null; username: string };
  activityTags: { tag: { id: string; name: string } }[];
  _count: { memberships: number };
};

type ActivityType = {
  id: string;
  name: string;
  order: number;
  prerequisiteTypeId: string | null;
  defaultCapacity: number;
  isEnabled: boolean;
  prerequisiteType: { id: string; name: string } | null;
};

type Tag = {
  id: string;
  name: string;
  _count: { activityTags: number };
};

type Props = {
  activities: Activity[];
  types: ActivityType[];
  tags: Tag[];
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'FULL', label: 'Full' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
];

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-800',
  FULL: 'bg-yellow-100 text-yellow-800',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
};

export function ActivityList({ activities, types, tags }: Props) {
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = statusFilter === 'ALL'
    ? activities
    : activities.filter((a) => a.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'activity' : 'activities'}
          </span>
        </div>
        <Link href="/admin/activities/new">
          <Button>Create Activity</Button>
        </Link>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No activities found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityRow({ activity }: { activity: Activity }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm(`Delete "${activity.title}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteActivity(activity.id);
      if (result.errors?._form) {
        setError(result.errors._form[0]);
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{activity.title}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[activity.status] ?? ''}`}
            >
              {activity.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>Type: {activity.type.name}</span>
            <span>
              Members: {activity._count.memberships}/{activity.capacity}
            </span>
            {activity.location && <span>Location: {activity.location}</span>}
            {activity.isOnline && <span>Online</span>}
          </div>
          {activity.activityTags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {activity.activityTags.map(({ tag }) => (
                <span
                  key={tag.id}
                  className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
        <div className="flex items-center gap-1">
          {activity.status === 'OPEN' && (
            <Link href={`/admin/activities/${activity.id}/edit`}>
              <Button variant="ghost" size="xs">
                Edit
              </Button>
            </Link>
          )}
          <Button
            variant="destructive"
            size="xs"
            onClick={handleDelete}
            disabled={isPending}
          >
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
