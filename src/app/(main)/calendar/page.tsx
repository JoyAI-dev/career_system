import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserCalendarEvents } from '@/server/queries/calendar';
import { getRecruitmentEvents } from '@/server/queries/recruitment';
import { CalendarView } from '@/components/Calendar';

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [events, recruitmentEvents] = await Promise.all([
    getUserCalendarEvents(session.user.id),
    getRecruitmentEvents(),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Calendar</h1>
      <CalendarView
        events={JSON.parse(JSON.stringify(events))}
        recruitmentEvents={JSON.parse(JSON.stringify(recruitmentEvents))}
      />
    </div>
  );
}
