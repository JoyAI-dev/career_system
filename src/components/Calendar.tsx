'use client';

import { useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import zhCnLocale from '@fullcalendar/core/locales/zh-cn';
import type { EventClickArg } from '@fullcalendar/core';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type CalendarEvent = {
  id: string;
  title: string;
  status: string;
  scheduledAt: string;
  location: string | null;
  isOnline: boolean;
  type: { id: string; name: string };
};

type RecruitmentEvent = {
  id: string;
  title: string;
  company: string;
  description: string | null;
  eventDate: string;
};

type SelectedItem =
  | { kind: 'activity'; data: CalendarEvent }
  | { kind: 'recruitment'; data: RecruitmentEvent };

type Props = {
  events: CalendarEvent[];
  recruitmentEvents?: RecruitmentEvent[];
};

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  SCHEDULED: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  IN_PROGRESS: { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8' },
  COMPLETED: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  FULL: { bg: '#fef9c3', border: '#eab308', text: '#854d0e' },
  OPEN: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
};

const RECRUITMENT_COLORS = { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' };

export function CalendarView({ events, recruitmentEvents = [] }: Props) {
  const calendarRef = useRef<FullCalendar>(null);
  const [selected, setSelected] = useState<SelectedItem | null>(null);

  const activityCalendarEvents = events.map((event) => {
    const colors = STATUS_COLORS[event.status] ?? STATUS_COLORS.SCHEDULED;
    return {
      id: `activity-${event.id}`,
      title: event.title,
      start: event.scheduledAt,
      backgroundColor: colors.bg,
      borderColor: colors.border,
      textColor: colors.text,
      extendedProps: { kind: 'activity' as const, data: event },
    };
  });

  const recruitmentCalendarEvents = recruitmentEvents.map((event) => ({
    id: `recruitment-${event.id}`,
    title: `${event.company} - ${event.title}`,
    start: event.eventDate,
    backgroundColor: RECRUITMENT_COLORS.bg,
    borderColor: RECRUITMENT_COLORS.border,
    textColor: RECRUITMENT_COLORS.text,
    extendedProps: { kind: 'recruitment' as const, data: event },
  }));

  const allEvents = [...activityCalendarEvents, ...recruitmentCalendarEvents];

  function handleEventClick(info: EventClickArg) {
    const props = info.event.extendedProps as SelectedItem;
    setSelected(props);
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: STATUS_COLORS.SCHEDULED.border }} />
          Activities
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: RECRUITMENT_COLORS.border }} />
          Recruitment
        </span>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView="dayGridMonth"
          locale={zhCnLocale}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek',
          }}
          events={allEvents}
          eventClick={handleEventClick}
          height="auto"
          dayMaxEvents={3}
          nowIndicator
          eventDisplay="block"
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }}
        />
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected?.kind === 'activity' && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.data.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Type:</span>
                  <span className="text-sm">{selected.data.type.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Status:</span>
                  <span
                    className="rounded px-1.5 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: STATUS_COLORS[selected.data.status]?.bg,
                      color: STATUS_COLORS[selected.data.status]?.text,
                    }}
                  >
                    {selected.data.status === 'IN_PROGRESS' ? 'In Progress' : selected.data.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Time:</span>
                  <span className="text-sm">
                    {new Date(selected.data.scheduledAt).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </span>
                </div>
                {(selected.data.location || selected.data.isOnline) && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Location:</span>
                    <span className="text-sm">
                      {selected.data.isOnline ? 'Online' : selected.data.location}
                    </span>
                  </div>
                )}
                <div className="pt-2">
                  <Link
                    href="/activities"
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    View in Activities
                  </Link>
                </div>
              </div>
            </>
          )}
          {selected?.kind === 'recruitment' && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.data.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Company:</span>
                  <span className="text-sm">{selected.data.company}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Date:</span>
                  <span className="text-sm">
                    {new Date(selected.data.eventDate).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </span>
                </div>
                {selected.data.description && (
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Description:</span>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{selected.data.description}</p>
                  </div>
                )}
                <div className="pt-1">
                  <span
                    className="rounded px-1.5 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: RECRUITMENT_COLORS.bg,
                      color: RECRUITMENT_COLORS.text,
                    }}
                  >
                    Recruitment
                  </span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
