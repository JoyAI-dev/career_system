import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserCalendarEvents } from '@/server/queries/calendar';
import { getRecruitmentEvents } from '@/server/queries/recruitment';
import { getActivityTypes } from '@/server/queries/activityType';
import { CalendarView } from '@/components/Calendar';
import { getTranslations } from 'next-intl/server';

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [events, recruitmentEvents, types, t] = await Promise.all([
    getUserCalendarEvents(session.user.id),
    getRecruitmentEvents(),
    getActivityTypes(),
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
        recruitmentEvents={JSON.parse(JSON.stringify(recruitmentEvents))}
        activityTypes={enabledTypes}
      />
      </Suspense>
    </div>
  );
}
