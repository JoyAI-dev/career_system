'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ActivityCard } from '@/components/ActivityCard';
import { ActivityDetailDialog } from '@/components/ActivityDetailDialog';
import { getActivityForCalendarPopup } from '@/server/actions/activity';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
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
  typeId: string;
  type: { id: string; name: string };
  activityTags: { tag: Tag }[];
  _count: { memberships: number };
  isEligible: boolean;
  isMember?: boolean;
  memberRole?: string;
};

type ActivityDetail = NonNullable<Awaited<ReturnType<typeof getActivityForCalendarPopup>>>;

type Props = {
  activities: Activity[];
  types: ActivityType[];
  tags: Tag[];
  /** When true, join calls joinActivityType(typeId) instead of joinActivity(id) */
  joinByType?: boolean;
  /** Current user ID for community features in the detail dialog */
  currentUserId?: string;
};

export function ActivityBrowser({ activities, types, tags, joinByType, currentUserId }: Props) {
  const t = useTranslations('activities');
  const tCal = useTranslations('calendar');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');

  // Lazy-loaded full detail for the popup
  const [activityDetail, setActivityDetail] = useState<ActivityDetail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const loadingRef = useRef<string | null>(null);

  const filtered = activities.filter((a) => {
    if (typeFilter !== 'ALL' && a.typeId !== typeFilter) return false;
    if (tagFilter !== 'ALL' && !a.activityTags.some((at) => at.tag.id === tagFilter))
      return false;
    return true;
  });

  // In joinByType mode, type filter is hidden since cards already represent types
  const showTypeFilter = !joinByType;

  const handleCardClick = useCallback(async (activityId: string) => {
    loadingRef.current = activityId;
    setLoadingId(activityId);
    setActivityDetail(null);

    try {
      const detail = await getActivityForCalendarPopup(activityId);
      if (loadingRef.current === activityId && detail) {
        setActivityDetail(detail);
      }
    } catch (err) {
      console.error('Failed to load activity detail:', err);
    } finally {
      if (loadingRef.current === activityId) {
        setLoadingId(null);
      }
    }
  }, []);

  const handleClose = useCallback(() => {
    setActivityDetail(null);
    setLoadingId(null);
    loadingRef.current = null;
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!activityDetail) return;
    try {
      const detail = await getActivityForCalendarPopup(activityDetail.id);
      if (detail) setActivityDetail(detail);
    } catch (err) {
      console.error('Failed to refresh activity detail:', err);
    }
  }, [activityDetail]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {showTypeFilter && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by activity type"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="ALL">{t('allTypes')}</option>
            {types.map((ty) => (
              <option key={ty.id} value={ty.id}>
                {ty.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          aria-label="Filter by tag"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="ALL">{t('allTags')}</option>
          {tags.map((tg) => (
            <option key={tg.id} value={tg.id}>
              {tg.name}
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
              onClick={() => handleCardClick(activity.id)}
            />
          ))}
        </div>
      )}

      {/* Loading spinner */}
      <Dialog open={!!loadingId} onOpenChange={(open) => {
        if (!open) { setLoadingId(null); loadingRef.current = null; }
      }}>
        <DialogContent className="sm:max-w-xs">
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{tCal('loadingDetail')}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full detail dialog */}
      <ActivityDetailDialog
        activity={activityDetail}
        onClose={handleClose}
        joinByType={joinByType}
        currentUserId={currentUserId}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
