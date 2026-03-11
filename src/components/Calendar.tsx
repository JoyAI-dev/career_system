'use client';

import { useRef, useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import zhCnLocale from '@fullcalendar/core/locales/zh-cn';
import enLocale from '@fullcalendar/core/locales/en-au';
import frLocale from '@fullcalendar/core/locales/fr';
import type { EventClickArg } from '@fullcalendar/core';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const FC_LOCALES: Record<string, typeof zhCnLocale> = {
  zh: zhCnLocale,
  en: enLocale,
  fr: frLocale,
};

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

type ActivityType = { id: string; name: string };

type SelectedItem =
  | { kind: 'activity'; data: CalendarEvent }
  | { kind: 'recruitment'; data: RecruitmentEvent };

type Props = {
  events: CalendarEvent[];
  recruitmentEvents?: RecruitmentEvent[];
  activityTypes?: ActivityType[];
};

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  SCHEDULED: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  IN_PROGRESS: { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8' },
  COMPLETED: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  FULL: { bg: '#fef9c3', border: '#eab308', text: '#854d0e' },
  OPEN: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
};

const STATUS_KEYS: Record<string, string> = {
  OPEN: 'statusOpen',
  FULL: 'statusFull',
  SCHEDULED: 'statusScheduled',
  IN_PROGRESS: 'statusInProgress',
  COMPLETED: 'statusCompleted',
};

const RECRUITMENT_COLORS = { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' };

export function CalendarView({ events, recruitmentEvents = [], activityTypes = [] }: Props) {
  const t = useTranslations('calendar');
  const tAct = useTranslations('activities');
  const locale = useLocale();
  const calendarRef = useRef<FullCalendar>(null);
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [showActivities, setShowActivities] = useState(true);
  const [showRecruitment, setShowRecruitment] = useState(true);
  const [selectedTypeId, setSelectedTypeId] = useState<string>('all');

  const filteredActivityEvents = useMemo(() => {
    if (!showActivities) return [];
    return events.filter((e) => selectedTypeId === 'all' || e.type.id === selectedTypeId);
  }, [events, showActivities, selectedTypeId]);

  const filteredRecruitmentEvents = useMemo(() => {
    if (!showRecruitment) return [];
    return recruitmentEvents;
  }, [recruitmentEvents, showRecruitment]);

  const calendarEvents = useMemo(() => {
    const activityItems = filteredActivityEvents.map((event) => {
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

    const recruitmentItems = filteredRecruitmentEvents.map((event) => ({
      id: `recruitment-${event.id}`,
      title: `${event.company} - ${event.title}`,
      start: event.eventDate,
      backgroundColor: RECRUITMENT_COLORS.bg,
      borderColor: RECRUITMENT_COLORS.border,
      textColor: RECRUITMENT_COLORS.text,
      extendedProps: { kind: 'recruitment' as const, data: event },
    }));

    return [...activityItems, ...recruitmentItems];
  }, [filteredActivityEvents, filteredRecruitmentEvents]);

  function handleEventClick(info: EventClickArg) {
    const props = info.event.extendedProps as SelectedItem;
    setSelected(props);
  }

  // Derive unique types from the user's events for the filter
  const availableTypes = useMemo(() => {
    const typeIds = new Set(events.map((e) => e.type.id));
    return activityTypes.filter((t) => typeIds.has(t.id));
  }, [events, activityTypes]);

  return (
    <>
      {/* Filter toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant={showActivities ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowActivities(!showActivities)}
          >
            <span
              className="mr-1.5 inline-block h-2.5 w-2.5 rounded"
              style={{ backgroundColor: STATUS_COLORS.SCHEDULED.border }}
            />
            {t('activities')}
          </Button>
          <Button
            variant={showRecruitment ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowRecruitment(!showRecruitment)}
          >
            <span
              className="mr-1.5 inline-block h-2.5 w-2.5 rounded"
              style={{ backgroundColor: RECRUITMENT_COLORS.border }}
            />
            {t('recruitment')}
          </Button>
        </div>

        {showActivities && availableTypes.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t('type')}</span>
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">{t('allTypes')}</option>
              {availableTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView="dayGridMonth"
          locale={FC_LOCALES[locale] ?? zhCnLocale}
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

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected?.kind === 'activity' && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.data.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">{t('type')}</span>
                  <span className="text-sm">{selected.data.type.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">{t('status')}</span>
                  <span
                    className="rounded px-1.5 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: STATUS_COLORS[selected.data.status]?.bg,
                      color: STATUS_COLORS[selected.data.status]?.text,
                    }}
                  >
                    {tAct(STATUS_KEYS[selected.data.status] ?? 'statusOpen')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">{t('time')}</span>
                  <span className="text-sm">
                    {new Date(selected.data.scheduledAt).toLocaleString()}
                  </span>
                </div>
                {(selected.data.location || selected.data.isOnline) && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">{t('location')}</span>
                    <span className="text-sm">
                      {selected.data.isOnline ? t('online') : selected.data.location}
                    </span>
                  </div>
                )}
                <div className="pt-2">
                  <Link
                    href="/activities"
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {t('viewInActivities')}
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
                  <span className="text-sm font-medium text-muted-foreground">{t('company')}</span>
                  <span className="text-sm">{selected.data.company}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">{t('date')}</span>
                  <span className="text-sm">
                    {new Date(selected.data.eventDate).toLocaleString()}
                  </span>
                </div>
                {selected.data.description && (
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">{t('description')}</span>
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
                    {t('recruitment')}
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
