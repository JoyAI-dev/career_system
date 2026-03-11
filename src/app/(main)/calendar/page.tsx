import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserCalendarEvents } from '@/server/queries/calendar';
import { CalendarView } from '@/components/Calendar';

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const events = await getUserCalendarEvents(session.user.id);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Calendar</h1>
      <CalendarView events={JSON.parse(JSON.stringify(events))} />
    </div>
  );
}
