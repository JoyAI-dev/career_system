'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ClipboardList, Users, BarChart3, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActivityDetailDialog } from '@/components/ActivityDetailDialog';
import { getActivityForCalendarPopup } from '@/server/actions/activity';
import { Dialog, DialogContent } from '@/components/ui/dialog';

type ActivityDetail = NonNullable<Awaited<ReturnType<typeof getActivityForCalendarPopup>>>;

type CurrentActivity = {
  id: string;
  title: string;
  status: string;
  typeName: string;
};

interface Props {
  /** Name of the current activity type (e.g. "圆桌会议") */
  currentTypeName: string | null;
  /** Activities in the current type that the user is involved in */
  currentActivities: CurrentActivity[];
  currentUserId: string;
}

const STATUS_DOT: Record<string, string> = {
  OPEN: 'bg-green-400',
  FULL: 'bg-yellow-400',
  SCHEDULED: 'bg-blue-400',
  IN_PROGRESS: 'bg-purple-400',
  COMPLETED: 'bg-gray-400',
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: '开放中',
  FULL: '已满',
  SCHEDULED: '已安排',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
};

export function ActivityJourneyFlow({ currentTypeName, currentActivities, currentUserId }: Props) {
  const t = useTranslations('dashboard');
  const tCal = useTranslations('calendar');

  // Lazy-loaded activity detail for popup
  const [activityDetail, setActivityDetail] = useState<ActivityDetail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const loadingRef = useRef<string | null>(null);

  const handleClick = useCallback(async (activityId: string) => {
    loadingRef.current = activityId;
    setLoadingId(activityId);
    setActivityDetail(null);
    try {
      const detail = await getActivityForCalendarPopup(activityId);
      if (loadingRef.current === activityId && detail) {
        setActivityDetail(detail);
      }
    } catch (err) {
      console.error('Failed to load activity detail:', err);
    } finally {
      if (loadingRef.current === activityId) {
        setLoadingId(null);
      }
    }
  }, []);

  const handleClose = useCallback(() => {
    setActivityDetail(null);
    setLoadingId(null);
    loadingRef.current = null;
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!activityDetail) return;
    try {
      const detail = await getActivityForCalendarPopup(activityDetail.id);
      if (detail) setActivityDetail(detail);
    } catch {}
  }, [activityDetail]);

  const flowTitle = currentTypeName
    ? `${currentTypeName}流程`
    : t('journeyFlowTitle');

  return (
    <>
      <div className="rounded-xl border bg-gradient-to-b from-blue-50/50 to-white p-5">
        <h3 className="mb-4 text-base font-semibold text-foreground">{flowTitle}</h3>
        <div className="grid grid-cols-3 gap-3">
          {/* Step 1: 摸索认知边界 */}
          <Link
            href="/questionnaire"
            className="group flex flex-col items-center gap-2 rounded-lg border bg-white p-4 text-center transition-colors hover:border-primary/30 hover:bg-primary/5"
          >
            <span className="text-2xl font-bold text-green-600">1</span>
            <ClipboardList className="size-5 text-green-600" />
            <span className="text-xs font-medium leading-tight text-green-700">
              {t('step1Label')}
            </span>
          </Link>

          {/* Step 2: Current activities */}
          <div className="flex flex-col items-center gap-2 rounded-lg border bg-white p-4 text-center">
            <span className="text-2xl font-bold text-blue-600">2</span>
            <Users className="size-5 text-blue-600" />
            {currentActivities.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                {t('step2Empty')}
              </span>
            ) : (
              <div className="w-full space-y-1.5">
                {currentActivities.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleClick(a.id)}
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-muted"
                  >
                    <span className={cn('size-1.5 shrink-0 rounded-full', STATUS_DOT[a.status] ?? 'bg-gray-400')} />
                    <span className="flex-1 truncate font-medium">{a.typeName}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                    <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step 3: 认知边界对比图 */}
          <Link
            href="/cognitive-report"
            className="group flex flex-col items-center gap-2 rounded-lg border bg-white p-4 text-center transition-colors hover:border-primary/30 hover:bg-primary/5"
          >
            <span className="text-2xl font-bold text-orange-600">3</span>
            <BarChart3 className="size-5 text-orange-600" />
            <span className="text-xs font-medium leading-tight text-orange-700">
              {t('step3Label')}
            </span>
          </Link>
        </div>
      </div>

      {/* Loading spinner */}
      <Dialog open={!!loadingId} onOpenChange={(open) => {
        if (!open) { setLoadingId(null); loadingRef.current = null; }
      }}>
        <DialogContent className="sm:max-w-xs">
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{tCal('loadingDetail')}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full detail dialog */}
      <ActivityDetailDialog
        activity={activityDetail}
        onClose={handleClose}
        currentUserId={currentUserId}
        onRefresh={handleRefresh}
      />
    </>
  );
}
