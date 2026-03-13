'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { markAnnouncementViewed } from '@/server/actions/announcement';

type Props = {
  announcement: {
    id: string;
    title: string;
    content: string;
    countdownSeconds: number;
  } | null;
  /** Whether this user has already completed a full countdown viewing */
  hasViewed: boolean;
};

const SESSION_KEY = 'announcement_dismissed';

export function AnnouncementPopup({ announcement, hasViewed }: Props) {
  const t = useTranslations('announcement');
  const [open, setOpen] = useState(!!announcement);
  const needsCountdown = !hasViewed;
  const [countdown, setCountdown] = useState(
    needsCountdown ? (announcement?.countdownSeconds ?? 20) : 0,
  );
  const markedRef = useRef(false);

  const canClose = hasViewed || countdown <= 0;

  // If already dismissed in this browser session, close immediately on mount
  useEffect(() => {
    if (announcement && sessionStorage.getItem(`${SESSION_KEY}_${announcement.id}`)) {
      setOpen(false);
    }
  }, [announcement]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // When countdown reaches 0 for a first-time viewer, notify server
  // This is the ONLY way the "hasViewed" flag gets set in the database
  useEffect(() => {
    if (needsCountdown && countdown === 0 && announcement && !markedRef.current) {
      markedRef.current = true;
      markAnnouncementViewed(announcement.id);
    }
  }, [needsCountdown, countdown, announcement]);

  const handleDismiss = useCallback(() => {
    if (!canClose) return;
    // Mark dismissed for this browser session so it won't re-appear on page navigation
    if (announcement) {
      sessionStorage.setItem(`${SESSION_KEY}_${announcement.id}`, '1');
    }
    setOpen(false);
  }, [canClose, announcement]);

  // Don't render the Dialog at all when closed or no announcement.
  // This avoids Base UI Dialog controlled mode state desync issues:
  // Base UI's store uses `openProp ?? open` selector and syncs via
  // useLayoutEffect, which can desynchronize internal vs controlled state.
  if (!announcement || !open) return null;

  return (
    <Dialog
      defaultOpen
      modal
      onOpenChange={(_nextOpen, eventDetails) => {
        // During countdown, cancel the close event so Base UI doesn't
        // update internal state while we keep the dialog mounted
        if (!canClose) {
          eventDetails.cancel();
          return;
        }
        handleDismiss();
      }}
    >
      <DialogContent showCloseButton={canClose} className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{announcement.title}</DialogTitle>
        </DialogHeader>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {announcement.content}
          </ReactMarkdown>
        </div>
        <div className="flex justify-end pt-2">
          {canClose ? (
            <Button onClick={handleDismiss}>{t('close')}</Button>
          ) : (
            <Button disabled>
              {t('closeIn', { seconds: countdown })}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
