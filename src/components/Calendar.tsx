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

type Props = {
  events: CalendarEvent[];
};

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  SCHEDULED: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  IN_PROGRESS: { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8' },
  COMPLETED: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  FULL: { bg: '#fef9c3', border: '#eab308', text: '#854d0e' },
  OPEN: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
};

export function CalendarView({ events }: Props) {
  const calendarRef = useRef<FullCalendar>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const calendarEvents = events.map((event) => {
    const colors = STATUS_COLORS[event.status] ?? STATUS_COLORS.SCHEDULED;
    return {
      id: event.id,
      title: event.title,
      start: event.scheduledAt,
      backgroundColor: colors.bg,
      borderColor: colors.border,
      textColor: colors.text,
      extendedProps: event,
    };
  });

  function handleEventClick(info: EventClickArg) {
    const event = info.event.extendedProps as CalendarEvent;
    setSelectedEvent(event);
  }

  return (
    <>
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
          events={calendarEvents}
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

      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Type:</span>
                <span className="text-sm">{selectedEvent.type.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Status:</span>
                <span
                  className="rounded px-1.5 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: STATUS_COLORS[selectedEvent.status]?.bg,
                    color: STATUS_COLORS[selectedEvent.status]?.text,
                  }}
                >
                  {selectedEvent.status === 'IN_PROGRESS' ? 'In Progress' : selectedEvent.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Time:</span>
                <span className="text-sm">
                  {new Date(selectedEvent.scheduledAt).toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </span>
              </div>
              {(selectedEvent.location || selectedEvent.isOnline) && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Location:</span>
                  <span className="text-sm">
                    {selectedEvent.isOnline ? 'Online' : selectedEvent.location}
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
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
