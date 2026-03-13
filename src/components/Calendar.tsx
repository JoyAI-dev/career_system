'use client';

import { useRef, useState, useMemo, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import zhCnLocale from '@fullcalendar/core/locales/zh-cn';
import enLocale from '@fullcalendar/core/locales/en-au';
import frLocale from '@fullcalendar/core/locales/fr';
import type { EventClickArg } from '@fullcalendar/core';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ActivityDetailDialog } from '@/components/ActivityDetailDialog';
import { getActivityForCalendarPopup } from '@/server/actions/activity';
import { Loader2 } from 'lucide-react';

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
  type: { id: string; name: string; order: number };
};

type RecruitmentEvent = {
  id: string;
  title: string;
  company: string;
  description: string | null;
  eventDate: string;
};

type ActivityType = { id: string; name: string };

type Props = {
  events: CalendarEvent[];
  recruitmentEvents?: RecruitmentEvent[];
  activityTypes?: ActivityType[];
  userId: string;
};

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  SCHEDULED: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  IN_PROGRESS: { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8' },
  COMPLETED: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  FULL: { bg: '#fef9c3', border: '#eab308', text: '#854d0e' },
  OPEN: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
};

const RECRUITMENT_COLORS = { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' };

// Type for ActivityDetailDialog's activity prop (inferred from server action return)
type ActivityDetail = NonNullable<Awaited<ReturnType<typeof getActivityForCalendarPopup>>>;

export function CalendarView({ events, recruitmentEvents = [], activityTypes = [], userId }: Props) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const calendarRef = useRef<FullCalendar>(null);
  const [showActivities, setShowActivities] = useState(true);
  const [showRecruitment, setShowRecruitment] = useState(true);
  const [selectedTypeId, setSelectedTypeId] = useState<string>('all');

  // Activity detail popup state
  const [activityDetail, setActivityDetail] = useState<ActivityDetail | null>(null);
  const [loadingActivityId, setLoadingActivityId] = useState<string | null>(null);
  const loadingRef = useRef<string | null>(null);

  // Recruitment popup state (kept simple)
  const [selectedRecruitment, setSelectedRecruitment] = useState<RecruitmentEvent | null>(null);

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
        extendedProps: { kind: 'activity' as const, activityId: event.id, typeOrder: event.type.order },
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

  const handleEventClick = useCallback(async (info: EventClickArg) => {
    const props = info.event.extendedProps;

    if (props.kind === 'recruitment') {
      setSelectedRecruitment(props.data as RecruitmentEvent);
      return;
    }

    // Activity click — lazy load full detail
    const activityId = props.activityId as string;
    loadingRef.current = activityId;
    setLoadingActivityId(activityId);
    setActivityDetail(null);

    try {
      const detail = await getActivityForCalendarPopup(activityId);
      // Guard against race condition: only set if this is still the active request
      if (loadingRef.current === activityId && detail) {
        setActivityDetail(detail);
      }
    } catch (err) {
      console.error('Failed to load activity detail:', err);
    } finally {
      if (loadingRef.current === activityId) {
        setLoadingActivityId(null);
      }
    }
  }, []);

  const handleActivityDetailClose = useCallback(() => {
    setActivityDetail(null);
    setLoadingActivityId(null);
    loadingRef.current = null;
  }, []);

  const handleActivityRefresh = useCallback(async () => {
    if (!activityDetail) return;
    try {
      const detail = await getActivityForCalendarPopup(activityDetail.id);
      if (detail) {
        setActivityDetail(detail);
      }
    } catch (err) {
      console.error('Failed to refresh activity detail:', err);
    }
  }, [activityDetail]);

  // Sort events: activities by type order, then time
  const eventOrder = useCallback((a: unknown, b: unknown) => {
    const aObj = a as { extendedProps?: Record<string, unknown> };
    const bObj = b as { extendedProps?: Record<string, unknown> };
    const orderA = (aObj.extendedProps?.typeOrder as number) ?? 999;
    const orderB = (bObj.extendedProps?.typeOrder as number) ?? 999;
    return orderA - orderB;
  }, []);

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
          eventOrder={eventOrder}
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

      {/* Loading spinner dialog */}
      <Dialog open={!!loadingActivityId} onOpenChange={(open) => {
        if (!open) {
          setLoadingActivityId(null);
          loadingRef.current = null;
        }
      }}>
        <DialogContent className="sm:max-w-xs">
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t('loadingDetail')}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full activity detail dialog (reuses the same component as activities page) */}
      <ActivityDetailDialog
        activity={activityDetail}
        onClose={handleActivityDetailClose}
        currentUserId={userId}
        onRefresh={handleActivityRefresh}
      />

      {/* Recruitment event dialog (kept simple) */}
      <Dialog open={!!selectedRecruitment} onOpenChange={(open) => !open && setSelectedRecruitment(null)}>
        <DialogContent>
          {selectedRecruitment && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedRecruitment.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">{t('company')}</span>
                  <span className="text-sm">{selectedRecruitment.company}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">{t('date')}</span>
                  <span className="text-sm">
                    {new Date(selectedRecruitment.eventDate).toLocaleString()}
                  </span>
                </div>
                {selectedRecruitment.description && (
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">{t('description')}</span>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{selectedRecruitment.description}</p>
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
