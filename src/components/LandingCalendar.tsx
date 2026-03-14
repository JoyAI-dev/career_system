import { getUserCalendarEvents, getUserPendingActivities } from '@/server/queries/calendar';
import { getRecruitmentEvents } from '@/server/queries/recruitment';
import { getActivityTypes } from '@/server/queries/activityType';
import { CalendarView } from '@/components/Calendar';

interface LandingCalendarProps {
  userId: string;
}

export async function LandingCalendar({ userId }: LandingCalendarProps) {
  const [events, pendingActivities, recruitmentEvents, types] = await Promise.all([
    getUserCalendarEvents(userId),
    getUserPendingActivities(userId),
    getRecruitmentEvents(),
    getActivityTypes(),
  ]);

  const enabledTypes = types
    .filter((t) => t.isEnabled)
    .map((t) => ({ id: t.id, name: t.name }));

  return (
    <section>
      <CalendarView
        events={JSON.parse(JSON.stringify(events))}
        pendingActivities={JSON.parse(JSON.stringify(pendingActivities))}
        recruitmentEvents={JSON.parse(JSON.stringify(recruitmentEvents))}
        activityTypes={enabledTypes}
        userId={userId}
      />
    </section>
  );
}
