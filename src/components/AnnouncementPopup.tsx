'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  forceCountdown: boolean;
};

export function AnnouncementPopup({ announcement, forceCountdown }: Props) {
  const t = useTranslations('announcement');
  const [open, setOpen] = useState(!!announcement);
  const [countdown, setCountdown] = useState(
    forceCountdown ? (announcement?.countdownSeconds ?? 20) : 0,
  );

  useEffect(() => {
    // Clean up ?registered=true from URL
    if (forceCountdown && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('registered')) {
        url.searchParams.delete('registered');
        window.history.replaceState({}, '', url.pathname + url.search);
      }
    }
  }, [forceCountdown]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // When countdown reaches 0, notify server so forced mode won't repeat
  useEffect(() => {
    if (forceCountdown && countdown === 0 && announcement) {
      markAnnouncementViewed(announcement.id);
    }
  }, [forceCountdown, countdown, announcement]);

  if (!announcement) return null;

  const canClose = !forceCountdown || countdown <= 0;

  function handleDismiss() {
    if (!canClose) return;
    if (!forceCountdown && announcement) {
      markAnnouncementViewed(announcement.id);
    }
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && canClose) {
          handleDismiss();
        }
      }}
    >
      <DialogContent showCloseButton={canClose} className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{announcement.title}</DialogTitle>
        </DialogHeader>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
