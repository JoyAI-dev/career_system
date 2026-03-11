'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ActivityCard } from '@/components/ActivityCard';
import { ActivityDetailDialog } from '@/components/ActivityDetailDialog';
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

interface ActivityCardsRowProps {
  activities: JoinedActivity[];
}

export function ActivityCardsRow({ activities }: ActivityCardsRowProps) {
  const t = useTranslations('dashboard');
  const [selectedActivity, setSelectedActivity] = useState<JoinedActivity | null>(null);

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
                onClick={() => setSelectedActivity(activity)}
              />
            </div>
          ))}
        </div>
      )}

      <ActivityDetailDialog
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />
    </section>
  );
}
