import dynamic from 'next/dynamic';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserCalendarEvents } from '@/server/queries/calendar';
import { getRecruitmentEvents } from '@/server/queries/recruitment';
import { getActivityTypes } from '@/server/queries/activityType';

const CalendarView = dynamic(
  () => import('@/components/Calendar').then((mod) => mod.CalendarView),
  { ssr: false, loading: () => <div className="flex h-96 items-center justify-center text-muted-foreground">Loading calendar...</div> },
);

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [events, recruitmentEvents, types] = await Promise.all([
    getUserCalendarEvents(session.user.id),
    getRecruitmentEvents(),
    getActivityTypes(),
  ]);

  const enabledTypes = types
    .filter((t) => t.isEnabled)
    .map((t) => ({ id: t.id, name: t.name }));

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Calendar</h1>
      <CalendarView
        events={JSON.parse(JSON.stringify(events))}
        recruitmentEvents={JSON.parse(JSON.stringify(recruitmentEvents))}
        activityTypes={enabledTypes}
      />
    </div>
  );
}
