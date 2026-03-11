import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserCalendarEvents } from '@/server/queries/calendar';
import { getRecruitmentEvents } from '@/server/queries/recruitment';
import { getActivityTypes } from '@/server/queries/activityType';
import { CalendarView } from '@/components/Calendar';

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
