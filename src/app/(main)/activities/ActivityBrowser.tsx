'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ActivityCard } from '@/components/ActivityCard';
import { ActivityDetailDialog } from '@/components/ActivityDetailDialog';
import type { ActivityStatus } from '@prisma/client';

type Tag = { id: string; name: string };
type ActivityType = { id: string; name: string };

type Activity = {
  id: string;
  title: string;
  capacity: number;
  status: ActivityStatus;
  guideMarkdown: string | null;
  isOnline: boolean;
  location: string | null;
  scheduledAt: string | null;
  createdAt: string;
  typeId: string;
  type: { id: string; name: string };
  activityTags: { tag: Tag }[];
  _count: { memberships: number };
  isEligible: boolean;
  isMember?: boolean;
  memberRole?: string;
};

type Props = {
  activities: Activity[];
  types: ActivityType[];
  tags: Tag[];
};

export function ActivityBrowser({ activities, types, tags }: Props) {
  const t = useTranslations('activities');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  const filtered = activities.filter((a) => {
    if (typeFilter !== 'ALL' && a.typeId !== typeFilter) return false;
    if (tagFilter !== 'ALL' && !a.activityTags.some((at) => at.tag.id === tagFilter))
      return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by activity type"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="ALL">{t('allTypes')}</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          aria-label="Filter by tag"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="ALL">{t('allTags')}</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">
          {t('count', { count: filtered.length })}
        </span>
      </div>

      {/* Card Grid */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          {t('noResults')}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onClick={() => setSelectedActivity(activity)}
            />
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <ActivityDetailDialog
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />
    </div>
  );
}
