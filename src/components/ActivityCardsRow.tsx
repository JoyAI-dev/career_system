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
import type { ActivityStatus, MemberRole } from '@prisma/client';

type Tag = { id: string; name: string };

type JoinedActivity = {
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
  isMember: boolean;
  memberRole: MemberRole;
  memberCompletedAt?: string | null;
};

type ActivityDetail = NonNullable<Awaited<ReturnType<typeof getActivityForCalendarPopup>>>;

interface ActivityCardsRowProps {
  activities: JoinedActivity[];
  currentUserId?: string;
}

export function ActivityCardsRow({ activities, currentUserId }: ActivityCardsRowProps) {
  const t = useTranslations('dashboard');
  const tCal = useTranslations('calendar');

  const [activityDetail, setActivityDetail] = useState<ActivityDetail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const loadingRef = useRef<string | null>(null);

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
    <section>
      <p className="mb-3 text-sm text-muted-foreground">
        {t('activitiesHint')}
      </p>

      {activities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">{t('noJoinedActivities')}</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none">
          {activities.map((activity) => (
            <div key={activity.id} className="w-[220px] shrink-0 snap-start">
              <ActivityCard
                activity={activity}
                onClick={() => handleCardClick(activity.id)}
              />
            </div>
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
        currentUserId={currentUserId}
        onRefresh={handleRefresh}
      />
    </section>
  );
}
