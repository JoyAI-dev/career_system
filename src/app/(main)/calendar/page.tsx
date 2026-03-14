import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserCalendarEvents, getUserPendingActivities, getProjectedActivityChain } from '@/server/queries/calendar';
import { getRecruitmentEvents } from '@/server/queries/recruitment';
import { getActivityTypes } from '@/server/queries/activityType';
import { CalendarView } from '@/components/Calendar';
import { getTranslations } from 'next-intl/server';

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [events, pendingActivities, recruitmentEvents, types, projectedChain, t] = await Promise.all([
    getUserCalendarEvents(session.user.id),
    getUserPendingActivities(session.user.id),
    getRecruitmentEvents(),
    getActivityTypes(),
    getProjectedActivityChain(session.user.id),
    getTranslations('calendar'),
  ]);

  const enabledTypes = types
    .filter((t) => t.isEnabled)
    .map((t) => ({ id: t.id, name: t.name }));

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{t('title')}</h1>
      <Suspense fallback={<div className="flex h-96 items-center justify-center text-muted-foreground">{t('loading')}</div>}>
      <CalendarView
        events={JSON.parse(JSON.stringify(events))}
        pendingActivities={JSON.parse(JSON.stringify(pendingActivities))}
        recruitmentEvents={JSON.parse(JSON.stringify(recruitmentEvents))}
        activityTypes={enabledTypes}
        userId={session.user.id}
        projectedChain={JSON.parse(JSON.stringify(projectedChain))}
      />
      </Suspense>
    </div>
  );
}
